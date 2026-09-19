' Runs start.cmd with no console window. Shortcut target.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
rc = sh.Run("cmd /c """ & dir & "\start.cmd""", 0, True)
If rc <> 0 Then
  MsgBox "Cafe Attendance could not start." & vbCrLf & _
         "See " & sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\CafeAttendance\server.log", _
         vbCritical, "Cafe Attendance"
End If
