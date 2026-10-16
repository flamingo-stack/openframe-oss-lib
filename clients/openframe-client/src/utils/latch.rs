//! A one-way flag: set once, observed by any clone, never cleared for the life of the process.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Clone, Default)]
pub struct Latch(Arc<AtomicBool>);

impl Latch {
    pub fn set(&self) {
        self.0.store(true, Ordering::Release);
    }

    pub fn is_set(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

#[cfg(test)]
#[path = "latch_tests.rs"]
mod tests;
