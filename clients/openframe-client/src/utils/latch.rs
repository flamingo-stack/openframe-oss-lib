use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Clone, Default)]
pub struct Latch(Arc<AtomicBool>);

impl Latch {
    pub fn set(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    pub fn is_set(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }

    pub fn view(&self) -> LatchView {
        LatchView(self.0.clone())
    }
}

#[derive(Clone)]
pub struct LatchView(Arc<AtomicBool>);

impl LatchView {
    pub fn is_set(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
#[path = "latch_tests.rs"]
mod tests;
