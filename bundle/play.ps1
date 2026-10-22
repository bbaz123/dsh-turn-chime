param(
    [Parameter(Mandatory = $true)][string]$SoundPath
)

$ErrorActionPreference = 'Stop'

try {
    $player = New-Object System.Media.SoundPlayer -ArgumentList $SoundPath
    $player.PlaySync()
    exit 0
}
catch {
    exit 1
}
