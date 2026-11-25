#[cfg(test)]
pub(crate) mod fixtures;
#[cfg(any(target_os = "windows", test))]
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

#[cfg(any(target_os = "windows", test))]
pub(crate) use gate::manageability;
pub use model::*;
#[cfg(target_os = "windows")]
pub(super) use read::read_inventory;
