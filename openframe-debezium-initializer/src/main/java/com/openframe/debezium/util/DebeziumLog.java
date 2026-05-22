package com.openframe.debezium.util;

/**
 * Centralises the log-line prefix used by Grafana/Loki alert rules. The literal
 * is the single string that LogQL rules in
 * {@code manifests/platform/grafana/alerting/rules/debezium-health.yaml}
 * match against — keep it stable.
 */
public final class DebeziumLog {

    public static final String PREFIX = "[DEBEZIUM]";

    private DebeziumLog() {
    }
}
