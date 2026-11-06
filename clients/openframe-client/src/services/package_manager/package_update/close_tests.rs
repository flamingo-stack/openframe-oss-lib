use super::*;
use tokio::time::timeout;

const BOUND: Duration = Duration::from_secs(10);

#[tokio::test]
async fn closing_holders_stops_them_even_when_they_ignore_the_request() {
    let mut app = if cfg!(target_os = "windows") {
        std::process::Command::new("ping")
            .args(["-n", "120", "127.0.0.1"])
            .stdout(std::process::Stdio::null())
            .spawn()
            .unwrap()
    } else {
        std::process::Command::new("sleep")
            .arg("120")
            .spawn()
            .unwrap()
    };

    let survivors = timeout(CLOSE_GRACE + BOUND, close(&[app.id()]))
        .await
        .expect("closing the holders hung");
    assert!(survivors.is_empty(), "survivors: {survivors:?}");

    let exited = timeout(BOUND, async {
        loop {
            if app.try_wait().unwrap().is_some() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await;
    if exited.is_err() {
        let _ = app.kill();
        panic!("the holder survived its forced close");
    }
}

#[tokio::test]
async fn closing_nothing_returns_at_once() {
    let survivors = timeout(Duration::from_secs(1), close(&[]))
        .await
        .expect("an empty close waited");
    assert!(survivors.is_empty());
}
