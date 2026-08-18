param(
  [Parameter(Mandatory=$false)]
  [string]$ProjectRef = "sipkaobshktuikowskzb",

  [Parameter(Mandatory=$false)]
  [string]$ProjectUrl = "https://sipkaobshktuikowskzb.supabase.co"
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  throw "SUPABASE_ACCESS_TOKEN is not set. In PowerShell run: `$env:SUPABASE_ACCESS_TOKEN='sbp_...'"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$migrationDir = Join-Path $repoRoot "supabase\migrations"
$apiUrl = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
$headers = @{
  Authorization = "Bearer $($env:SUPABASE_ACCESS_TOKEN)"
  "Content-Type" = "application/json"
}

function Invoke-SupabaseSql {
  param([Parameter(Mandatory=$true)][string]$Sql)
  $payload = @{ query = $Sql } | ConvertTo-Json -Depth 8
  return Invoke-RestMethod -Method Post -Uri $apiUrl -Headers $headers -Body $payload
}

Write-Host "Checking Supabase project $ProjectRef..." -ForegroundColor Cyan
$projectCheck = Invoke-SupabaseSql "select current_database() as db, now() as checked_at;"
Write-Host "Connected." -ForegroundColor Green

$existing = Invoke-SupabaseSql "select to_regclass('public.products') is not null as commerce_exists;"
$commerceExists = $false
if ($existing -and $existing.Count -gt 0) {
  $commerceExists = [bool]$existing[0].commerce_exists
}

if (-not $commerceExists) {
  Write-Host "Applying 001_commerce.sql..." -ForegroundColor Cyan
  $sql1 = Get-Content (Join-Path $migrationDir "001_commerce.sql") -Raw
  Invoke-SupabaseSql $sql1 | Out-Null
  Write-Host "Commerce schema applied." -ForegroundColor Green
} else {
  Write-Host "Commerce tables already exist; skipping 001_commerce.sql." -ForegroundColor Yellow
}

Write-Host "Applying journal seed (safe to re-run)..." -ForegroundColor Cyan
$sql2 = Get-Content (Join-Path $migrationDir "002_seed_journal.sql") -Raw
Invoke-SupabaseSql $sql2 | Out-Null
Write-Host "Journal seed applied." -ForegroundColor Green

Write-Host "Applying product merchandising migration..." -ForegroundColor Cyan
$sql3 = Get-Content (Join-Path $migrationDir "003_product_merchandising.sql") -Raw
Invoke-SupabaseSql $sql3 | Out-Null
Write-Host "Product merchandising schema applied." -ForegroundColor Green

Write-Host "Applying Stripe catalogue/payments migration..." -ForegroundColor Cyan
$sql4 = Get-Content (Join-Path $migrationDir "004_stripe_catalog_payments.sql") -Raw
Invoke-SupabaseSql $sql4 | Out-Null
Write-Host "Stripe catalogue/payments schema applied." -ForegroundColor Green

Write-Host "Verifying schema..." -ForegroundColor Cyan
$verifySql = @"
select
  to_regclass('public.products') is not null as products,
  to_regclass('public.product_variants') is not null as product_variants,
  to_regclass('public.orders') is not null as orders,
  to_regclass('public.order_items') is not null as order_items,
  to_regclass('public.journal_posts') is not null as journal_posts,
  to_regclass('public.categories') is not null as categories,
  to_regclass('public.attributes') is not null as attributes,
  to_regclass('public.zq_sync_log') is not null as zq_sync_log,
  to_regclass('public.payment_settings') is not null as payment_settings,
  to_regclass('public.stripe_webhook_events') is not null as stripe_webhook_events,
  (select count(*) from public.journal_posts where status='published') as published_journal_posts;
"@
$verification = Invoke-SupabaseSql $verifySql
$verification | Format-Table -AutoSize

Write-Host "Checking RLS..." -ForegroundColor Cyan
$rlsSql = @"
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles','products','product_variants','product_images','addresses','orders','order_items','order_events','wishlist_items','newsletter_subscribers','contact_messages','journal_posts','discount_codes','categories','collections','tags','attributes','attribute_values','product_attributes','zq_sync_log','product_links','payment_settings','stripe_webhook_events')
order by relname;
"@
$rls = Invoke-SupabaseSql $rlsSql
$rls | Format-Table -AutoSize

Write-Host "Supabase setup complete for $ProjectUrl" -ForegroundColor Green
Write-Host "IMPORTANT: rotate the PAT and service-role key after setup because they were shared in chat." -ForegroundColor Yellow
