#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayAction {
    Open,
    Settings,
    History,
    Exit,
}

#[derive(Debug, Default)]
pub struct TrayState {
    pub visible: bool,
}

impl TrayState {
    pub fn open(&mut self) {
        self.visible = true;
    }

    pub fn hide(&mut self) {
        self.visible = false;
    }
}
