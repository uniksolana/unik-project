use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("ACYE3zhj2pWbe3GVPFVqqjDuJYAGM4BFXUw3b6XVwkyB");

#[program]
pub mod unik_anchor {
    use super::*;

    pub fn register_alias(ctx: Context<RegisterAlias>, alias: String, metadata_uri: String) -> Result<()> {
        let alias_account = &mut ctx.accounts.alias_account;
        alias_account.owner = ctx.accounts.user.key();
        alias_account.alias = alias;
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
        
        // Validate splits total 100% (10000 basis points)
        let total_percentage: u64 = splits.iter().map(|s| s.percentage as u64).sum();
        require!(total_percentage <= 10000, UnikError::InvalidSplitTotal);

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
        space = 8 + 32 + 4 + (splits.len() * 42) + 1 + 100, 
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
}
