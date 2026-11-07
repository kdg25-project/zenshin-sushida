export type PresentationLeaveActions = { cancelStart(): void; stopCamera(): void; resetReadiness(message: string): void; setCameraStarting(starting: boolean): void; setView(view: "menu"): void };

/** The shared back/menu transition releases all camera and pending-start resources. */
export function leavePresentationToMenu(actions: PresentationLeaveActions, message: string) {
  actions.cancelStart();
  actions.stopCamera();
  actions.resetReadiness(message);
  actions.setCameraStarting(false);
  actions.setView("menu");
}
