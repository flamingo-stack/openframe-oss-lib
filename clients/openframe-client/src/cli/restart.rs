use std::process;

use tokio::runtime::Runtime;
use tracing::{error, info};

use crate::service::Service;

pub(super) fn run(rt: &Runtime) -> ! {
    super::init_file_logging();
    info!("Restarting the OpenFrame client service");

    match rt.block_on(Service::nudge_restart()) {
        Ok(()) => {
            info!("OpenFrame client service restarted");
            process::exit(0);
        }
        Err(e) => {
            error!("Failed to restart the OpenFrame client service: {:#}", e);
            process::exit(1);
        }
    }
}
