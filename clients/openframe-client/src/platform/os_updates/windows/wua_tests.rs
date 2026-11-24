use std::mem::ManuallyDrop;

use windows::Win32::System::Variant::{VARIANT_0, VARIANT_0_0, VARIANT_0_0_0, VT_R8};

use super::*;
use crate::platform::os_updates::windows::fixtures::at;

fn variant(vt: windows::Win32::System::Variant::VARENUM, date: f64) -> VARIANT {
    VARIANT {
        Anonymous: VARIANT_0 {
            Anonymous: ManuallyDrop::new(VARIANT_0_0 {
                vt,
                wReserved1: 0,
                wReserved2: 0,
                wReserved3: 0,
                Anonymous: VARIANT_0_0_0 { date },
            }),
        },
    }
}

fn decimal(high: u32, low: u64, scale: u8, sign: u8) -> DECIMAL {
    let mut value = DECIMAL {
        Hi32: high,
        ..Default::default()
    };
    value.Anonymous1.Anonymous.scale = scale;
    value.Anonymous1.Anonymous.sign = sign;
    value.Anonymous2.Lo64 = low;
    value
}

#[test]
fn ole_dates_are_days_since_1899_12_30() {
    let cases = [
        (25569.0, "1970-01-01T00:00:00Z"),
        (2.0, "1900-01-01T00:00:00Z"),
        (36526.5, "2000-01-01T12:00:00Z"),
        (45000.25, "2023-03-15T06:00:00Z"),
    ];
    for (days, expected) in cases {
        assert_eq!(ole_date(days), Some(at(expected)), "{days}");
    }
}

#[test]
fn an_ole_date_lands_on_the_second_it_was_written_for() {
    let second = 1.0 / 86_400.0;
    let days = 46340.0 + 12_345.0 * second;
    let date = ole_date(days).unwrap();
    assert_eq!(date.timestamp_subsec_millis(), 0);
    assert_eq!(date, at("2026-11-14T03:25:45Z"));
}

#[test]
fn an_empty_or_broken_ole_date_is_no_date() {
    for days in [0.0, -1.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        assert_eq!(ole_date(days), None, "{days}");
    }
}

#[test]
fn only_a_date_variant_is_a_date() {
    assert_eq!(
        variant_date(&variant(VT_DATE, 25569.0)),
        Some(at("1970-01-01T00:00:00Z"))
    );
    assert_eq!(variant_date(&variant(VT_R8, 25569.0)), None);
    assert_eq!(variant_date(&VARIANT::default()), None);
}

#[test]
fn decimals_become_whole_bytes() {
    let cases = [
        (decimal(0, 0, 0, 0), Some(0)),
        (decimal(0, 1_582_442, 0, 0), Some(1_582_442)),
        (decimal(0, 1_582_442, 3, 0), Some(1_582)),
        (decimal(0, u64::MAX, 0, 0), Some(u64::MAX)),
        (decimal(1, 0, 1, 0), Some(1_844_674_407_370_955_161)),
        (decimal(1, 0, 0, 0), None),
        (decimal(0, 5, 0, 0x80), None),
        (decimal(0, 5, 255, 0), None),
    ];
    for (index, (value, expected)) in cases.into_iter().enumerate() {
        assert_eq!(decimal_bytes(value), expected, "case {index}");
    }
}

#[test]
fn a_read_is_refused_while_the_previous_one_hangs() {
    let hanging = READER.begin();
    let started = Instant::now();

    let readings = read();

    assert!(started.elapsed() < Duration::from_secs(1));
    for error in [
        readings.applicable.err(),
        readings.last_scan.err(),
        readings.history.err(),
        readings.reboot_required.err(),
        readings.update_services.err(),
    ] {
        assert_eq!(
            error.expect("refused").message,
            "the previous read has not finished"
        );
    }
    drop(hanging);
    assert!(!READER.view().is_active());
}

#[test]
#[ignore = "reads the live Windows Update agent; run explicitly with --ignored"]
fn the_live_agent_answers_every_reading() {
    let readings = read();

    readings.applicable.expect("search");
    readings.last_scan.expect("last scan");
    readings.history.expect("history");
    readings.reboot_required.expect("reboot");
    assert!(!readings.update_services.expect("services").is_empty());
    assert!(!READER.view().is_active());
}
