use anchor_lang::prelude::*;
use anchor_lang::system_program;

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
        alias_account.bump = ctx.bumps.alias_account;
        
        msg!("Alias registered: {}", alias_account.alias);
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

        let user_info = ctx.accounts.user.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();

        for split in splits {
            let recipient_acc = remaining_accounts.iter()
                .find(|acc| acc.key() == split.recipient)
                .ok_or(UnikError::MissingRecipient)?;

            let split_amount = (amount as u128)
                .checked_mul(split.percentage as u128)
                .ok_or(UnikError::Overflow)?
                .checked_div(10000)
                .ok_or(UnikError::Overflow)? as u64;

            if split_amount > 0 {
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

    pub fn create_payment_request(ctx: Context<CreatePaymentRequest>, recipient_alias: String, amount: u64, concept: String) -> Result<()> {
        let request = &mut ctx.accounts.payment_request;
        request.sender = ctx.accounts.sender.key();
        request.recipient_alias = recipient_alias;
        request.amount = amount;
        request.concept = concept;
        request.timestamp = Clock::get()?.unix_timestamp;
        request.bump = ctx.bumps.payment_request;
        
        msg!("Payment request created for alias: {} for {} lamports", request.recipient_alias, amount);
        Ok(())
    }

    pub fn close_payment_request(_ctx: Context<ClosePaymentRequest>) -> Result<()> {
        msg!("Payment request closed and rent recovered.");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(alias: String)]
pub struct RegisterAlias<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 4 + 32 + 4 + 128 + 1,
        seeds = [b"alias", alias.as_bytes()],
        bump
    )]
    pub alias_account: Account<'info, AliasAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
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
#[instruction(recipient_alias: String)]
pub struct CreatePaymentRequest<'info> {
    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 36 + 8 + 100 + 8 + 1, // Fixed space for request
        seeds = [b"request", recipient_alias.as_bytes(), sender.key().as_ref()],
        bump
    )]
    pub payment_request: Account<'info, PaymentRequest>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClosePaymentRequest<'info> {
    #[account(
        mut,
        close = receiver,
        seeds = [b"request", payment_request.recipient_alias.as_bytes(), payment_request.sender.as_ref()],
        bump = payment_request.bump,
        constraint = receiver.key() == payment_request.sender || receiver.key() == receiver_alias.owner
    )]
    pub payment_request: Account<'info, PaymentRequest>,

    #[account(
        seeds = [b"alias", payment_request.recipient_alias.as_bytes()],
        bump = receiver_alias.bump
    )]
    pub receiver_alias: Account<'info, AliasAccount>,

    #[account(mut)]
    pub receiver: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AliasAccount {
    pub owner: Pubkey,
    pub alias: String, // Max 32 chars
    pub metadata_uri: String, // Max 128 chars
    pub bump: u8,
}

#[account]
pub struct RouteAccount {
    pub alias_ref: Pubkey,
    pub splits: Vec<Split>,
    pub bump: u8,
}

#[account]
pub struct PaymentRequest {
    pub sender: Pubkey,
    pub recipient_alias: String, // Max 32 chars
    pub amount: u64,
    pub concept: String, // Max 100 chars
    pub timestamp: i64,
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
}
