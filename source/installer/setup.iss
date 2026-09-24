; Inno Setup script for Cafe Attendance. Built by build-installer.cmd.
#define AppName "Cafe Attendance"
#define AppVersion "1.0.0"
; Staged app folder; build-installer.cmd passes /DStage=<path outside the source tree>.
#ifndef Stage
  #define Stage "stage"
#endif

[Setup]
AppId={{7E3C1C0A-5B7D-4A6F-9E2B-2F1A6D8C4B10}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Cafe Attendance
DefaultDirName={localappdata}\Programs\CafeAttendance
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=CafeAttendance-Setup
Compression=lzma2
SolidCompression=yes
DisableProgramGroupPage=yes
UninstallDisplayName={#AppName}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
WizardStyle=modern

[Files]
Source: "{#Stage}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"
Name: "{group}\Stop {#AppName}"; Filename: "{app}\stop.cmd"; WorkingDir: "{app}"; Flags: runminimized; IconFilename: "{app}\icon.ico"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"
Name: "{userstartup}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; WorkingDir: "{app}"; Tasks: autostart; IconFilename: "{app}\icon.ico"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"
Name: "autostart"; Description: "Start when Windows starts"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launch.vbs"""; Description: "Launch {#AppName}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\stop.cmd"; Flags: runhidden; RunOnceId: "stopnode"

[Code]
// Stop a running server before upgrading so node.exe is not "in use".
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  rc: Integer;
begin
  if FileExists(ExpandConstant('{app}\stop.cmd')) then
    Exec(ExpandConstant('{app}\stop.cmd'), '', '', SW_HIDE, ewWaitUntilTerminated, rc);
  Result := '';
end;

// After uninstall, offer to remove the attendance data (DB, secret, logs).
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  data: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    data := ExpandConstant('{localappdata}\CafeAttendance');
    if DirExists(data) and (not UninstallSilent) then
      if MsgBox('Also delete the attendance database and settings in' + #13#10 + data + '?' + #13#10#13#10 + 'Choose No to keep them for a future reinstall.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(data, True, True, True);
  end;
end;
