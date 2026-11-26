use std::time::Duration;

use super::*;

#[test]
fn connect_url_maps_the_server_scheme_to_websockets() {
    assert_eq!(
        build_connect_url("http://localhost:8100", "t"),
        "ws://localhost:8100/ws/nats-api?authorization=t"
    );
    assert_eq!(
        build_connect_url("https://acme.openframe.ai/", "t"),
        "wss://acme.openframe.ai/ws/nats-api?authorization=t"
    );
    assert_eq!(
        build_connect_url("acme.openframe.ai", "t"),
        "wss://acme.openframe.ai/ws/nats-api?authorization=t"
    );
}

#[test]
fn connect_url_encodes_everything_but_unreserved_characters() {
    assert_eq!(
        build_connect_url("https://acme.openframe.ai", "a.b-c_d~e+f/g=h&i"),
        "wss://acme.openframe.ai/ws/nats-api?authorization=a.b-c_d~e%2Bf%2Fg%3Dh%26i"
    );
}

#[test]
fn mask_token_hides_short_tokens_and_keeps_four_characters_at_each_end() {
    assert_eq!(mask_token(""), "****");
    assert_eq!(mask_token("12345678"), "****");
    assert_eq!(mask_token("eyJhbGciOiJIUzI1NiJ9"), "eyJh...NiJ9 (len 20)");
    assert_eq!(mask_token("ąęółśżźćńą"), "ąęół...źćńą (len 10)");
}

#[test]
fn mask_connect_url_leaves_no_token_in_the_url() {
    let token = "eyJhbGciOiJIUzI1NiJ9.secret-part.signature";
    let masked = mask_connect_url(&build_connect_url("https://acme.openframe.ai", token));

    assert_eq!(
        masked,
        "wss://acme.openframe.ai/ws/nats-api?authorization=eyJh...ture (len 42)"
    );
    assert!(!masked.contains("secret-part"));
    assert_eq!(
        mask_connect_url("wss://acme.openframe.ai/ws/nats-api"),
        "wss://acme.openframe.ai/ws/nats-api"
    );
}

#[test]
fn backoff_doubles_up_to_its_cap() {
    assert_eq!(backoff_ms(0), 1_000);
    assert_eq!(backoff_ms(1), 2_000);
    assert_eq!(backoff_ms(4), 16_000);
    assert_eq!(backoff_ms(5), 30_000);
    assert_eq!(backoff_ms(u32::MAX), 30_000);
}

#[test]
fn reconnect_delay_retries_fast_then_backs_off_with_jitter() {
    for _ in 0..200 {
        for attempt in 1..=3 {
            let delay = reconnect_delay(attempt);
            assert!(delay >= Duration::from_millis(100) && delay <= Duration::from_millis(200));
        }
        let delay = reconnect_delay(4);
        assert!(delay >= Duration::from_millis(500) && delay <= Duration::from_millis(1_000));
        for attempt in [10, 1_000, usize::MAX] {
            let delay = reconnect_delay(attempt);
            assert!(
                delay >= Duration::from_millis(15_000) && delay <= Duration::from_millis(30_000)
            );
        }
    }
}
