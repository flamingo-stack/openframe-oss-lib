package com.openframe.test.tests;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static com.openframe.test.api.DeviceApi.getAllDevices;
import static com.openframe.test.api.DeviceApi.getFleetOsVersion;
import static com.openframe.test.data.generator.DeviceGenerator.statDevicesFilter;
import static com.openframe.test.helpers.RequestSpecHelper.setBaseUrl;

@Disabled
public class StatsTest extends BaseTest {

    public static List<String> getDomains() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream is = StatsTest.class.getResourceAsStream("/openframe.all.tenants.json")) {
            List<Map<String, String>> tenants = mapper.readValue(is, new TypeReference<>() {
            });
            return tenants.stream().map(t -> t.get("domain")).toList();
        }
    }

    @Test
    public void collectStats() throws Exception {
        Map<String, Integer> stats = new ConcurrentHashMap<>();
        List<Future<?>> futures = new ArrayList<>();
        try (ExecutorService executor = Executors.newFixedThreadPool(15)) {
            for (String domain : getDomains()) {
                futures.add(executor.submit(() -> {
                    System.out.println(domain);
                    setBaseUrl("https://" + domain + "/");
                    List<String> fleetIds = getAllDevices(statDevicesFilter(), 100, null);
                    for (String fleetId : fleetIds) {
                        try {
                            Thread.sleep(50);
                            String osVersion = getFleetOsVersion(fleetId);
                            if (osVersion != null && !osVersion.isBlank())
                                stats.merge(normalizeOsVersion(osVersion), 1, Integer::sum);
                        } catch (Exception e) {
                        }
                    }
                }));
            }
            for (Future<?> future : futures) {
                future.get();
            }
        }
        List<Map.Entry<String, Integer>> sorted = stats.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .toList();
        for (Map.Entry<String, Integer> entry : sorted) {
            System.out.printf("%d\t%s%n", entry.getValue(), entry.getKey());
        }
        saveStats(sorted);
    }

    private static String normalizeOsVersion(String osVersion) {
        if (osVersion.startsWith("Windows")) {
            return osVersion.replaceAll("\\s+\\d+\\.\\d+\\.\\d+(\\.\\d+)?$", "");
        }
        return osVersion;
    }

    public static void saveStats(List<Map.Entry<String, Integer>> stats) throws IOException {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, Integer> entry : stats) {
            sb.append(String.format("%d\t%s%n", entry.getValue(), entry.getKey()));
        }
        Files.writeString(Path.of("stats.txt"), sb.toString());
    }

}
