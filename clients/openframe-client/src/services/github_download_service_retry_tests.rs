use super::GithubDownloadService;
use crate::platform::DmgExtractor;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const DROP_CONNECTION: u16 = 0;

async fn download(replies: &'static [u16]) -> (Option<Vec<u8>>, usize) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/asset.zip", listener.local_addr().unwrap());
    let hits = Arc::new(AtomicUsize::new(0));
    let counter = hits.clone();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let hit = counter.fetch_add(1, Ordering::SeqCst);
            let status = replies[hit.min(replies.len() - 1)];
            let mut buf = vec![0u8; 8192];
            let mut read = 0;
            while !String::from_utf8_lossy(&buf[..read]).contains("\r\n\r\n") {
                match socket.read(&mut buf[read..]).await {
                    Ok(0) | Err(_) => break,
                    Ok(n) => read += n,
                }
            }
            if status != DROP_CONNECTION {
                let reply = format!(
                    "HTTP/1.1 {status} Reply\r\nContent-Length: 4\r\nConnection: close\r\n\r\nbody"
                );
                let _ = socket.write_all(reply.as_bytes()).await;
            }
            let _ = socket.shutdown().await;
        }
    });

    let client = reqwest::Client::builder().no_proxy().build().unwrap();
    let service = GithubDownloadService::new(client, DmgExtractor::new());
    let result = service.download_with_retry(&url).await;
    (
        result.ok().map(|bytes| bytes.to_vec()),
        hits.load(Ordering::SeqCst),
    )
}

#[tokio::test]
async fn retries_a_server_error() {
    assert_eq!(download(&[504, 200]).await, (Some(b"body".to_vec()), 2));
}

#[tokio::test]
async fn retries_a_rate_limit() {
    assert_eq!(download(&[429, 200]).await, (Some(b"body".to_vec()), 2));
}

#[tokio::test]
async fn retries_a_forbidden_reply() {
    assert_eq!(download(&[403, 200]).await, (Some(b"body".to_vec()), 2));
}

#[tokio::test]
async fn retries_a_dropped_connection() {
    assert_eq!(
        download(&[DROP_CONNECTION, 200]).await,
        (Some(b"body".to_vec()), 2)
    );
}

#[tokio::test]
async fn fails_at_once_on_not_found() {
    assert_eq!(download(&[404, 200]).await, (None, 1));
}
