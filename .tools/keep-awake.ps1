# Keep the machine + display awake until this process is stopped.
# ES_CONTINUOUS (0x80000000) | ES_SYSTEM_REQUIRED (0x1) | ES_DISPLAY_REQUIRED (0x2)
Add-Type -Name Power -Namespace Win -MemberDefinition @'
[DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
$flags = [uint32]"0x80000000" -bor [uint32]"0x1" -bor [uint32]"0x2"
while ($true) {
    [Win.Power]::SetThreadExecutionState($flags) | Out-Null
    Start-Sleep -Seconds 50
}
