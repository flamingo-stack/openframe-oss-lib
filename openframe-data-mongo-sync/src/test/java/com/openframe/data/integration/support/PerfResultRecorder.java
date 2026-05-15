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
    private final Map<String, String> sectionDescriptions = new LinkedHashMap<>();
    private final Map<String, Object> meta = new LinkedHashMap<>();
    private final Map<String, Object> environment = new LinkedHashMap<>();
    private final List<Map<String, Object>> headlineRows = new ArrayList<>();
    private String headlineColumns = null;
    private String overview = null;

    public PerfResultRecorder(String suiteName) {
        this.suiteName = suiteName;
    }

    public PerfResultRecorder withMeta(String key, Object value) {
        meta.put(key, value);
        return this;
    }

    public PerfResultRecorder withEnvironment(String key, Object value) {
        environment.put(key, value);
        return this;
    }

    public PerfResultRecorder withOverview(String narrative) {
        this.overview = narrative;
        return this;
    }

    public PerfResultRecorder describe(String section, String narrative) {
        sectionDescriptions.put(section, narrative);
        return this;
    }

    public void record(String section, Object... keysAndValues) {
        Map<String, Object> row = pairsToRow(keysAndValues);
        sectionsToRows.computeIfAbsent(section, k -> new ArrayList<>()).add(row);
        log.info("[PERF] {}: {}", section, row);
    }

    public void headline(String columnsHeader, Object... keysAndValues) {
        if (headlineColumns == null) {
            headlineColumns = columnsHeader;
        }
        headlineRows.add(pairsToRow(keysAndValues));
    }

    private static Map<String, Object> pairsToRow(Object[] keysAndValues) {
        if ((keysAndValues.length & 1) != 0) {
            throw new IllegalArgumentException(
                    "expected even number of key/value args, got " + keysAndValues.length);
        }
        Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            row.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
        }
        return row;
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
                .append("_Started at `").append(startedAt).append("`._\n\n");

        if (overview != null) {
            out.append(overview).append("\n\n");
        }

        if (!environment.isEmpty()) {
            out.append("## Environment\n\n");
            environment.forEach((k, v) -> out.append("- **").append(k).append("**: `").append(v).append("`\n"));
            out.append('\n');
        }

        if (!meta.isEmpty()) {
            out.append("## Dataset and run parameters\n\n");
            meta.forEach((k, v) -> out.append("- **").append(k).append("**: `").append(v).append("`\n"));
            out.append('\n');
        }

        if (!headlineRows.isEmpty()) {
            out.append("## Summary\n\n");
            renderTable(out, headlineRows);
        }

        sectionsToRows.forEach((section, rows) -> {
            if (rows.isEmpty()) {
                return;
            }
            out.append("## ").append(section).append("\n\n");
            String description = sectionDescriptions.get(section);
            if (description != null) {
                out.append(description).append("\n\n");
            }
            renderTable(out, rows);
        });
        return out.toString();
    }

    private static void renderTable(StringBuilder out, List<Map<String, Object>> rows) {
        LinkedHashSet<String> headers = new LinkedHashSet<>();
        rows.forEach(row -> headers.addAll(row.keySet()));

        out.append('|');
        headers.forEach(h -> out.append(' ').append(h).append(" |"));
        out.append('\n').append('|').append("---|".repeat(headers.size())).append('\n');
        rows.forEach(row -> {
            out.append('|');
            headers.forEach(h -> out.append(' ').append(escape(row.get(h))).append(" |"));
            out.append('\n');
        });
        out.append('\n');
    }

    private static String escape(Object value) {
        if (value == null) {
            return "";
        }
        return value.toString().replace("|", "\\|").replace("\n", " ");
    }
}
