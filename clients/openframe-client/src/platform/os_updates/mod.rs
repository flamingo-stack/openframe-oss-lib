pub mod windows;

use windows::{Manageability, WindowsInventory};

#[cfg(target_os = "windows")]
pub fn read() -> Option<(WindowsInventory, Manageability)> {
    let inventory = windows::read_inventory();
    let manageability = windows::manageability(&inventory);
    Some((inventory, manageability))
}

#[cfg(not(target_os = "windows"))]
pub fn read() -> Option<(WindowsInventory, Manageability)> {
    None
}
