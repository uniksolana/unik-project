use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use anchor_spl::associated_token::get_associated_token_address;

declare_id!("ASA8xRVPFBQLo3dLJQH2NedBKJWsVXGu46radY6oRX6i");

#[program]
pub mod unik_anchor {
    use super::*;

    pub fn register_alias(ctx: Context<RegisterAlias>, alias: String, metadata_uri: String) -> Result<()> {
        // A. Alias Normalization and Validation
        require!(alias.len() >= 3 && alias.len() <= 32, UnikError::InvalidAliasLength);
        require!(alias.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'), UnikError::InvalidAliasCharacters);
        
        // E. Metadata Validation
        require!(metadata_uri.len() <= 200, UnikError::MetadataTooLong);

        let alias_account = &mut ctx.accounts.alias_account;
        alias_account.owner = ctx.accounts.user.key();
        alias_account.alias = alias.clone();
        alias_account.metadata_uri = metadata_uri;
        alias_account.version = 1;  // Initial version
        alias_account.is_active = true;  // Active by default
        alias_account.registered_at = Clock::get()?.unix_timestamp;
        alias_account.bump = ctx.bumps.alias_account;
        
        msg!("Alias registered: {} (version 1)", alias_account.alias);
        Ok(())
    }

    pub fn set_route_config(ctx: Context<SetRouteConfig>, alias: String, splits: Vec<Split>) -> Result<()> {
        let route_account = &mut ctx.accounts.route_account;
        let alias_account = &ctx.accounts.alias_account;
        
        // Authorization check: Only alias owner can set routes
        require!(alias_account.owner == ctx.accounts.user.key(), UnikError::Unauthorized);
        
        // Validate splits total 100% (10000 basis points) EXACTLY
        let total_percentage: u64 = splits.iter().map(|s| s.percentage as u64).sum();
        require!(total_percentage == 10000, UnikError::InvalidSplitTotal);

        // Max 5 splits allowed
        require!(splits.len() <= 5, UnikError::TooManySplits);

        // Duplicate check
        for (i, split) in splits.iter().enumerate() {
            // Check for duplicates
            for (j, other_split) in splits.iter().enumerate() {
                if i != j && split.recipient == other_split.recipient {
                    return err!(UnikError::DuplicateRecipient);
                }
            }
            // Check for self-reference (prevent route/alias loop)
            require!(split.recipient != route_account.key(), UnikError::SelfReference);
            require!(split.recipient != alias_account.key(), UnikError::SelfReference);
        }

        // TODO: V2 Implementation - Handle remainder (10000 - total_percentage)
        // Options: Send to Treasury, Refund to Owner, or Burn.
        // Current logic: Logic in execute_transfer simply doesn't move the remainder, 
        // effectively leaving it in the sender's wallet (since we only transfer calculated amounts).

        route_account.alias_ref = alias_account.key();
        route_account.splits = splits;
        route_account.bump = ctx.bumps.route_account;
        
        msg!("Route config set for alias: {} with {} splits", alias, route_account.splits.len());
        Ok(())
    }

    pub fn execute_transfer<'info>(ctx: Context<'_, '_, '_, 'info, ExecuteTransfer<'info>>, _alias: String, amount: u64) -> Result<()> {
        let route = &ctx.accounts.route_account;
        let splits = &route.splits;
        let remaining_accounts = ctx.remaining_accounts;

        msg!("Executing transfer of {} lamports for {} splits", amount, splits.len());

        // Extract account infos outside the loop to avoid lifetime issues
        let user_info = ctx.accounts.user.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();

        for split in splits {
            // Find the recipient account in remaining_accounts
            let recipient_acc = remaining_accounts.iter()
                .find(|acc| acc.key() == split.recipient)
                .ok_or(UnikError::MissingRecipient)?;

            let split_amount = (amount as u128)
                .checked_mul(split.percentage as u128)
                .ok_or(UnikError::Overflow)?
                .checked_div(10000)
                .ok_or(UnikError::Overflow)? as u64;

            if split_amount > 0 {
                // Perform transfer from user to recipient
                let cpi_context = CpiContext::new(
                    system_program_info.clone(),
                    system_program::Transfer {
                        from: user_info.clone(),
                        to: recipient_acc.clone(),
                    }
                );
                system_program::transfer(cpi_context, split_amount)?;
            }
        }
        Ok(())
    }

    pub fn execute_token_transfer<'info>(ctx: Context<'_, '_, '_, 'info, ExecuteTokenTransfer<'info>>, _alias: String, amount: u64) -> Result<()> {
        let route = &ctx.accounts.route_account;
        let splits = &route.splits;
        let remaining_accounts = ctx.remaining_accounts;
        let mint_key = ctx.accounts.mint.key();

        msg!("Executing TOKEN transfer of {} units for {} splits", amount, splits.len());

        // Validate that we have enough remaining accounts (one ATA per split)
        require!(remaining_accounts.len() >= splits.len(), UnikError::MissingRecipient);

        let user_token_info = ctx.accounts.user_token_account.to_account_info();
        let token_program_info = ctx.accounts.token_program.to_account_info();
        let authority_info = ctx.accounts.user.to_account_info();

        // Iterate through splits and validate each recipient ATA
        for (i, split) in splits.iter().enumerate() {
            // Derive the expected ATA address for this recipient and mint
            let expected_ata = get_associated_token_address(&split.recipient, &mint_key);
            
            // Get the ATA passed by the client (must be in same order as splits)
            let recipient_ata = &remaining_accounts[i];
            
            // CRITICAL SECURITY CHECK: Validate that the passed ATA matches the expected derived ATA
            require!(
                recipient_ata.key() == expected_ata,
                UnikError::InvalidRecipientAta
            );

            // Calculate split amount
            let split_amount = (amount as u128)
                .checked_mul(split.percentage as u128)
                .ok_or(UnikError::Overflow)?
                .checked_div(10000)
                .ok_or(UnikError::Overflow)? as u64;

            if split_amount > 0 {
                msg!("Sending {} tokens to recipient {} (ATA: {})", split_amount, split.recipient, recipient_ata.key());
                
                let cpi_accounts = Transfer {
                    from: user_token_info.clone(),
                    to: recipient_ata.clone(),
                    authority: authority_info.clone(),
                };
                let cpi_ctx = CpiContext::new(token_program_info.clone(), cpi_accounts);
                token::transfer(cpi_ctx, split_amount)?;
            }
        }
        
        msg!("Token transfer completed successfully");
        Ok(())
    }

    /// Update the metadata URI of an alias (owner only)
    pub fn update_alias_metadata(ctx: Context<UpdateAlias>, _alias: String, new_metadata_uri: String) -> Result<()> {
        require!(new_metadata_uri.len() <= 200, UnikError::MetadataTooLong);
        
        let alias_account = &mut ctx.accounts.alias_account;
        alias_account.metadata_uri = new_metadata_uri;
        
        msg!("Alias metadata updated");
        Ok(())
    }

    /// Deactivate an alias - payments to this alias will fail
    pub fn deactivate_alias(ctx: Context<UpdateAlias>, _alias: String) -> Result<()> {
        let alias_account = &mut ctx.accounts.alias_account;
        require!(alias_account.is_active, UnikError::AliasAlreadyInactive);
        
        alias_account.is_active = false;
        
        msg!("Alias deactivated: {}", alias_account.alias);
        Ok(())
    }

    /// Reactivate a previously deactivated alias
    pub fn reactivate_alias(ctx: Context<UpdateAlias>, _alias: String) -> Result<()> {
        let alias_account = &mut ctx.accounts.alias_account;
        require!(!alias_account.is_active, UnikError::AliasAlreadyActive);
        
        alias_account.is_active = true;
        
        msg!("Alias reactivated: {}", alias_account.alias);
        Ok(())
    }

    /// Delete an alias permanently - refunds rent to owner
    /// The alias becomes available for registration by anyone
    /// Version will increment if someone re-registers it
    pub fn delete_alias(ctx: Context<DeleteAlias>, _alias: String) -> Result<()> {
        // Note: Anchor automatically closes the account and refunds rent to `close = user`
        msg!("Alias deleted: {}", ctx.accounts.alias_account.alias);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct RegisterAlias<'info> {
    #[account(
        init,
        payer = user,
        // 8 (discriminator) + 32 (owner) + 4+32 (alias string) + 4+200 (metadata_uri) + 8 (version) + 1 (is_active) + 8 (registered_at) + 1 (bump)
        space = 8 + 32 + 4 + 32 + 4 + 200 + 8 + 1 + 8 + 1,
        seeds = [b"alias", alias.as_bytes()],
        bump
    )]
    pub alias_account: Account<'info, AliasAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct UpdateAlias<'info> {
    #[account(
        mut,
        seeds = [b"alias", alias.as_bytes()],
        bump = alias_account.bump,
        constraint = alias_account.owner == user.key() @ UnikError::Unauthorized,
    )]
    pub alias_account: Account<'info, AliasAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct DeleteAlias<'info> {
    #[account(
        mut,
        seeds = [b"alias", alias.as_bytes()],
        bump = alias_account.bump,
        constraint = alias_account.owner == user.key() @ UnikError::Unauthorized,
        close = user,  // Refund rent to user
    )]
    pub alias_account: Account<'info, AliasAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(alias: String, splits: Vec<Split>)]
pub struct SetRouteConfig<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 4 + (5 * 34) + 1 + 100, // Fixed space for max 5 splits
        seeds = [b"route", alias.as_bytes()],
        bump
    )]
    pub route_account: Account<'info, RouteAccount>,
    
    #[account(
        seeds = [b"alias", alias.as_bytes()],
        bump = alias_account.bump,
        constraint = alias_account.owner == user.key()
    )]
    pub alias_account: Account<'info, AliasAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct ExecuteTransfer<'info> {
    #[account(
        seeds = [b"route", alias.as_bytes()],
        bump = route_account.bump,
    )]
    pub route_account: Account<'info, RouteAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct ExecuteTokenTransfer<'info> {
    #[account(
        seeds = [b"route", alias.as_bytes()],
        bump = route_account.bump,
    )]
    pub route_account: Account<'info, RouteAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// The mint of the token being transferred - used to validate ATAs
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ UnikError::InvalidUserTokenAccount,
        constraint = user_token_account.mint == mint.key() @ UnikError::MintMismatch,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AliasAccount {
    pub owner: Pubkey,
    pub alias: String,         // Max 32 chars
    pub metadata_uri: String,  // Max 200 chars
    pub version: u64,          // Increments when owner changes (for contact safety)
    pub is_active: bool,       // Can be deactivated without deletion
    pub registered_at: i64,    // Unix timestamp of registration
    pub bump: u8,
}

#[account]
pub struct RouteAccount {
    pub alias_ref: Pubkey,
    pub splits: Vec<Split>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Split {
    pub recipient: Pubkey,
    pub percentage: u16, // Basis points (10000 = 100%)
}

#[error_code]
pub enum UnikError {
    #[msg("You are not the owner of this alias.")]
    Unauthorized,
    #[msg("Split percentages exceed 100%.")]
    InvalidSplitTotal,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Recipient account missing in remaining_accounts.")]
    MissingRecipient,
    #[msg("Alias must be between 3 and 32 characters.")]
    InvalidAliasLength,
    #[msg("Alias must contain only lowercase alphanumeric characters and underscores.")]
    InvalidAliasCharacters,
    #[msg("Metadata URI exceeds 200 characters.")]
    MetadataTooLong,
    #[msg("Maximum 5 splits allowed.")]
    TooManySplits,
    #[msg("Duplicate recipient in splits.")]
    DuplicateRecipient,
    #[msg("Cannot route funds to the alias or route account itself.")]
    SelfReference,
    #[msg("Invalid recipient ATA - does not match expected derived address.")]
    InvalidRecipientAta,
    #[msg("User token account owner mismatch.")]
    InvalidUserTokenAccount,
    #[msg("Token mint mismatch.")]
    MintMismatch,
    #[msg("Alias is already inactive.")]
    AliasAlreadyInactive,
    #[msg("Alias is already active.")]
    AliasAlreadyActive,
}
