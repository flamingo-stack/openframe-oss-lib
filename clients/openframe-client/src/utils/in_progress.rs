use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

#[derive(Clone, Default)]
pub struct InProgress(Arc<AtomicUsize>);

impl InProgress {
    pub fn begin(&self) -> InProgressGuard {
        self.0.fetch_add(1, Ordering::SeqCst);
        InProgressGuard(self.0.clone())
    }

    pub fn view(&self) -> InProgressView {
        InProgressView(self.0.clone())
    }
}

#[derive(Clone)]
pub struct InProgressView(Arc<AtomicUsize>);

impl InProgressView {
    pub fn is_active(&self) -> bool {
        self.0.load(Ordering::SeqCst) > 0
    }
}

/// Ends the operation it was returned for when dropped, including on panic.
#[must_use = "the operation ends as soon as the guard is dropped"]
pub struct InProgressGuard(Arc<AtomicUsize>);

impl Drop for InProgressGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

#[cfg(test)]
#[path = "in_progress_tests.rs"]
mod tests;
