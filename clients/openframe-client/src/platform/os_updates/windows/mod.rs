mod gate;
mod model;

#[cfg(target_os = "windows")]
mod cim;
#[cfg(target_os = "windows")]
mod machine;
#[cfg(target_os = "windows")]
mod read;
#[cfg(target_os = "windows")]
mod wua;

pub use gate::manageability;
pub use model::*;
#[cfg(target_os = "windows")]
pub use read::read_inventory;
