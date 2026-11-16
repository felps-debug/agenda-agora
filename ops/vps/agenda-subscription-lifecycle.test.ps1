$ErrorActionPreference = 'Stop'
$serviceFile = Join-Path $PSScriptRoot 'agenda-subscription-lifecycle.service'
$service = Get-Content -LiteralPath $serviceFile

function Assert-UnitDirective([string]$section, [string]$directive, [string]$expected) {
  $currentSection = ''
  foreach ($line in $service) {
    if ($line -match '^\[(.+)\]$') { $currentSection = $Matches[1]; continue }
    if ($currentSection -eq $section -and $line -match ('^' + [regex]::Escape($directive) + '=(.+)$')) {
      if ($Matches[1] -eq $expected) { return }
      throw "[$section] $directive expected '$expected', got '$($Matches[1])'"
    }
  }
  throw "Missing [$section] $directive=$expected in $serviceFile"
}

Assert-UnitDirective 'Unit' 'StartLimitIntervalSec' '1h'
Assert-UnitDirective 'Unit' 'StartLimitBurst' '3'
Assert-UnitDirective 'Service' 'Restart' 'on-failure'
Assert-UnitDirective 'Service' 'RestartSec' '5min'
Write-Output 'subscription lifecycle retry policy: passed'