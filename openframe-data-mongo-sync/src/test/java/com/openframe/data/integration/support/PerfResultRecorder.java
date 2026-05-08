package com.openframe.data.integration.support;

import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Slf4j
public final class PerfResultRecorder {

    private final String suiteName;
    private final Instant startedAt = Instant.now();
    private final Map<String, List<Map<String, Object>>> sectionsToRows = new LinkedHashMap<>();
    private final Map<String, Object> meta = new LinkedHashMap<>();

    public PerfResultRecorder(String suiteName) {
        this.suiteName = suiteName;
    }

    public PerfResultRecorder withMeta(String key, Object value) {
        meta.put(key, value);
        return this;
    }

    public void record(String section, Object... keysAndValues) {
        if ((keysAndValues.length & 1) != 0) {
            throw new IllegalArgumentException(
                    "record expected even number of key/value args, got " + keysAndValues.length);
        }
        Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            row.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
        }
        sectionsToRows.computeIfAbsent(section, k -> new ArrayList<>()).add(row);
        log.info("[PERF] {}: {}", section, row);
    }

    public void writeMarkdown(Path baseDir) throws IOException {
        Files.createDirectories(baseDir);
        String timestamp = startedAt.toString().replace(':', '-').replace('.', '-');
        Path md = baseDir.resolve(suiteName + "-" + timestamp + ".md");
        Files.writeString(md, render());
        log.info("[PERF] wrote markdown report: {}", md.toAbsolutePath());
    }

    private String render() {
        StringBuilder out = new StringBuilder()
                .append("# ").append(suiteName).append("\n\n")
                .append("Started at: `").append(startedAt).append("`\n\n");

        if (!meta.isEmpty()) {
            out.append("## Context\n\n");
            meta.forEach((k, v) -> out.append("- **").append(k).append("**: `").append(v).append("`\n"));
            out.append('\n');
        }

        sectionsToRows.forEach((section, rows) -> {
            if (rows.isEmpty()) {
                return;
            }
            LinkedHashSet<String> headers = new LinkedHashSet<>();
            rows.forEach(row -> headers.addAll(row.keySet()));

            out.append("## ").append(section).append("\n\n|");
            headers.forEach(h -> out.append(' ').append(h).append(" |"));
            out.append('\n').append('|').append("---|".repeat(headers.size())).append('\n');
            rows.forEach(row -> {
                out.append('|');
                headers.forEach(h -> out.append(' ').append(escape(row.get(h))).append(" |"));
                out.append('\n');
            });
            out.append('\n');
        });
        return out.toString();
    }

    private static String escape(Object value) {
        if (value == null) {
            return "";
        }
        return value.toString().replace("|", "\\|").replace("\n", " ");
    }
}
