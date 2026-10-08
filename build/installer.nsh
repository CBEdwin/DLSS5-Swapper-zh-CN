; Uninstalling the app does not touch any game folder: Restore originals is
; what puts a game back, from the backup it keeps in that game's own folder.
; People uninstalled first and were left with ReShade in their games (#266),
; so the uninstaller says so before it goes, and offers to stop. It stays
; silent during an update, which runs the old uninstaller on its own.
!macro customUnInit
  ${ifNot} ${isUpdated}
    IfSilent +3
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "Uninstalling DLSS 5 Swapper does not remove anything it installed into your games.$\r$\n$\r$\nTo put a game back the way it was, open DLSS 5 Swapper first and use Restore originals on it. The backup stays in each game folder, so you can also reinstall the app later and restore then.$\r$\n$\r$\nContinue uninstalling?" IDOK +2
    Quit
  ${endIf}
!macroend
