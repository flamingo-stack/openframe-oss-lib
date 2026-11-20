use std::collections::HashSet;
use std::sync::Arc;

use super::{Begin, CommandHandler, Outcome};
use crate::models::{
    DeliveryRef, PackageAdoptMessage, PACKAGE_ADOPT_DELIVERY_TYPE, PACKAGE_ADOPT_KIND,
};
use crate::services::package_manager::adopt::PackageAdoptRunner;

#[derive(Clone)]
pub struct PackageAdoptHandler {
    runner: Arc<PackageAdoptRunner>,
}

impl PackageAdoptHandler {
    pub fn new(runner: Arc<PackageAdoptRunner>) -> Self {
        Self { runner }
    }
}

impl CommandHandler for PackageAdoptHandler {
    type Command = PackageAdoptMessage;
    type Guard = ();

    const KIND: &'static str = PACKAGE_ADOPT_KIND;
    const DEFERRED_TYPE: Option<&'static str> = Some(PACKAGE_ADOPT_DELIVERY_TYPE);

    fn subject(machine_id: &str) -> String {
        format!("machine.{}.{}", machine_id, PACKAGE_ADOPT_KIND)
    }

    fn begin(&self, _command: &Self::Command) -> Begin<()> {
        Begin::Accepted(())
    }

    fn owed_deliveries(&self, _machine_id: &str) -> HashSet<String> {
        self.runner.owed()
    }

    async fn run(
        &self,
        machine_id: &str,
        delivery: &DeliveryRef,
        command: Self::Command,
        _guard: (),
    ) -> Outcome {
        self.runner.submit(machine_id, delivery.clone(), command);
        Outcome::Deferred
    }
}
