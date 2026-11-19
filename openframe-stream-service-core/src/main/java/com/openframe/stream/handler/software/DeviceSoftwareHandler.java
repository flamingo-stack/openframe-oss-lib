package com.openframe.stream.handler.software;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.openframe.stream.handler.software.FleetRowFields.differsOnlyIn;
import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.isSnapshotRead;
import static com.openframe.stream.handler.software.FleetRowFields.isUpdate;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@ConditionalOnProperty(name = "openframe.fleet.software-cdc.enabled", havingValue = "true")
@Slf4j
public class DeviceSoftwareHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    static final Duration SNAPSHOT_HOST_WINDOW = Duration.ofHours(24);
    static final Duration UNRESOLVED_HOST_WINDOW = Duration.ofMinutes(5);
    static final Duration RECONCILED_COMMIT_WINDOW = Duration.ofHours(1);
    static final long RECONCILED_COMMIT_CAPACITY = 100_000;
    static final String NO_COMMIT = "0";
    static final Set<String> UNTRACKED_COLUMNS = Set.of("last_opened_at", "updated_at");
    static final Duration HOST_REFRESH_WINDOW = Duration.ofHours(6);
    static final long HOST_REFRESH_CAPACITY = 100_000;

    private static final Pattern APP_PATH = Pattern.compile("(?:.*/)?([^/]+)\\.app", Pattern.CASE_INSENSITIVE);
    private static final Pattern TOP_LEVEL_APP_PATH = Pattern.compile(
            "(/Users/[^/]+)?/Applications/[^/]+\\.app", Pattern.CASE_INSENSITIVE);

    private final FleetHostResolver fleetHostResolver;
    private final FleetHostSoftwareCache fleetHostSoftwareCache;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjectionTrigger projectionTrigger;
    private final Set<Long> skippedHosts;

    private final Cache<Long, Boolean> snapshotReconciledHosts = Caffeine.newBuilder()
            .expireAfterWrite(SNAPSHOT_HOST_WINDOW)
            .build();
    private final Cache<Long, Boolean> unresolvedHosts = Caffeine.newBuilder()
            .expireAfterWrite(UNRESOLVED_HOST_WINDOW)
            .build();
    private final Cache<HostCommit, Boolean> reconciledCommits = Caffeine.newBuilder()
            .expireAfterWrite(RECONCILED_COMMIT_WINDOW)
            .maximumSize(RECONCILED_COMMIT_CAPACITY)
            .build();
    private final Cache<Long, Boolean> recentlyReconciledHosts = Caffeine.newBuilder()
            .expireAfterWrite(HOST_REFRESH_WINDOW)
            .maximumSize(HOST_REFRESH_CAPACITY)
            .build();

    public DeviceSoftwareHandler(FleetHostResolver fleetHostResolver,
                                 FleetHostSoftwareCache fleetHostSoftwareCache,
                                 DeviceSoftwareRepository deviceSoftwareRepository,
                                 SoftwareProjectionTrigger projectionTrigger,
                                 @Value("${openframe.fleet.software-cdc.skipped-hosts}") Set<Long> skippedHosts) {
        this.fleetHostResolver = fleetHostResolver;
        this.fleetHostSoftwareCache = fleetHostSoftwareCache;
        this.deviceSoftwareRepository = deviceSoftwareRepository;
        this.projectionTrigger = projectionTrigger;
        this.skippedHosts = skippedHosts;
    }

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_DEVICE_SOFTWARE;
    }

    @Override
    public void handle(DeserializedDebeziumMessage message, IntegratedToolEnrichedData extraParams) {
        DebeziumMessage.Payload<JsonNode> payload = message.getPayload();
        if (payload == null) {
            return;
        }
        String operation = payload.getOperation();
        JsonNode row = isDelete(operation) ? payload.getBefore() : payload.getAfter();
        if (row == null) {
            return;
        }
        Long hostId = longOrNull(row, "host_id");
        if (hostId == null || skippedHosts.contains(hostId)) {
            return;
        }
        boolean untrackedOnly = onlyUntrackedColumnsChanged(payload);
        boolean unresolved = unresolvedHosts.getIfPresent(hostId) != null;
        if (untrackedOnly && (recentlyReconciledHosts.getIfPresent(hostId) != null || unresolved)) {
            return;
        }
        boolean snapshotRead = isSnapshotRead(operation);
        if (snapshotRead && (snapshotReconciledHosts.getIfPresent(hostId) != null || unresolved)) {
            return;
        }
        String commit = commitOf(payload);
        HostCommit hostCommit = snapshotRead || NO_COMMIT.equals(commit) ? null : new HostCommit(hostId, commit);
        if (hostCommit != null && reconciledCommits.getIfPresent(hostCommit) != null) {
            return;
        }
        String fleetHostId = String.valueOf(hostId);
        if (!fleetHostResolver.isResolvable(fleetHostId)) {
            if (snapshotRead || untrackedOnly) {
                unresolvedHosts.put(hostId, Boolean.TRUE);
            }
            log.debug("[software-cdc] host_software for unresolved Fleet host {} — skipping", hostId);
            return;
        }
        FleetHostRef host = fleetHostResolver.resolve(fleetHostId);
        reconcile(host, hostId, commit);
        recentlyReconciledHosts.put(hostId, Boolean.TRUE);
        if (snapshotRead) {
            snapshotReconciledHosts.put(hostId, Boolean.TRUE);
        }
        if (hostCommit != null) {
            reconciledCommits.put(hostCommit, Boolean.TRUE);
        }
    }

    private record HostCommit(long hostId, String commit) {
    }

    private static boolean onlyUntrackedColumnsChanged(DebeziumMessage.Payload<JsonNode> payload) {
        String operation = payload.getOperation();
        JsonNode before = payload.getBefore();
        JsonNode after = payload.getAfter();
        return isUpdate(operation) && differsOnlyIn(before, after, UNTRACKED_COLUMNS);
    }

    private static String commitOf(DebeziumMessage.Payload<JsonNode> payload) {
        DebeziumMessage.Payload.Source source = payload.getSource();
        if (source != null && !isBlank(source.getGtid())) {
            return source.getGtid();
        }
        if (source != null && source.getTimestamp() != null) {
            return String.valueOf(source.getTimestamp());
        }
        Long emitted = payload.getTimestamp();
        return emitted == null ? NO_COMMIT : String.valueOf(emitted);
    }

    private void reconcile(FleetHostRef host, Long hostId, String commit) {
        String tenantId = host.tenantId();
        String machineId = host.machineId();
        List<HostSoftwareTitle> titles = fleetHostSoftwareCache.hostSoftware(tenantId, hostId, commit);
        List<DeviceSoftware> existingRows = deviceSoftwareRepository.findByTenantIdAndMachineId(tenantId, machineId);
        Map<Long, DeviceSoftware> existingByTitle = new HashMap<>();
        for (DeviceSoftware existing : existingRows) {
            existingByTitle.put(existing.getSoftwareTitleId(), existing);
        }
        Instant now = Instant.now();
        List<DeviceSoftware> changed = new ArrayList<>();
        Set<Long> affectedTitles = new HashSet<>();
        Set<String> affectedCves = new HashSet<>();

        for (HostSoftwareTitle title : titles) {
            Long titleId = title.getId();
            if (titleId == null) {
                continue;
            }
            DeviceSoftware existing = existingByTitle.remove(titleId);
            DeviceSoftware reported = reportedRow(host, titleId, title);
            if (existing != null && sameContent(existing, reported)) {
                continue;
            }
            if (existing != null) {
                reported.setId(existing.getId());
                reported.setMachineConnected(existing.isMachineConnected());
                List<String> previousCves = vulnerabilitiesOf(existing);
                affectedCves.addAll(previousCves);
            } else {
                reported.setMachineConnected(true);
            }
            reported.setUpdatedAt(now);
            changed.add(reported);
            affectedTitles.add(titleId);
            List<String> reportedCves = reported.getVulnerabilities();
            affectedCves.addAll(reportedCves);
        }

        List<String> staleIds = new ArrayList<>();
        for (DeviceSoftware stale : existingByTitle.values()) {
            staleIds.add(stale.getId());
            affectedTitles.add(stale.getSoftwareTitleId());
            List<String> staleCves = vulnerabilitiesOf(stale);
            affectedCves.addAll(staleCves);
        }

        if (!changed.isEmpty()) {
            deviceSoftwareRepository.saveAll(changed);
        }
        if (!staleIds.isEmpty()) {
            deviceSoftwareRepository.deleteAllById(staleIds);
        }

        projectionTrigger.titlesChanged(tenantId, affectedTitles);
        projectionTrigger.cvesChanged(tenantId, affectedCves);
    }

    private static DeviceSoftware reportedRow(FleetHostRef host, Long titleId, HostSoftwareTitle title) {
        String tenantId = host.tenantId();
        String machineId = host.machineId();
        String name = title.getName();
        String source = title.getSource();
        List<String> versions = versionsOf(title);
        String upgradeCode = title.getUpgradeCode();
        String vendor = firstOf(title, HostSoftwareInstalledVersion::getVendor);
        List<String> arpKeys = valuesOf(title, HostSoftwareInstalledVersion::getArpKey);
        List<String> packageFamilyNames = valuesOf(title, HostSoftwareInstalledVersion::getPackageFamilyName);
        List<String> installerTypes = valuesOf(title, HostSoftwareInstalledVersion::getInstallerType);
        Boolean systemComponent = systemComponentOf(title);
        String wingetId = firstOf(title, HostSoftwareInstalledVersion::getWingetId);
        boolean app = FleetSource.of(source) == FleetSource.APPS;
        List<String> appPaths = app ? installedPathsOf(title) : List.of();
        String bundleIdentifier = app ? title.getBundleIdentifier() : null;
        List<String> appFileNames = appFileNamesOf(appPaths);
        Boolean topLevelApp = topLevelAppOf(appPaths);
        List<String> vulnerabilities = vulnerabilitiesOf(title);

        DeviceSoftware row = new DeviceSoftware();
        row.setTenantId(tenantId);
        row.setMachineId(machineId);
        row.setSoftwareTitleId(titleId);
        row.setName(name);
        row.setSource(source);
        row.setVersions(versions);
        row.setUpgradeCode(upgradeCode);
        row.setVendor(vendor);
        row.setArpKeys(arpKeys);
        row.setPackageFamilyNames(packageFamilyNames);
        row.setInstallerTypes(installerTypes);
        row.setSystemComponent(systemComponent);
        row.setWingetId(wingetId);
        row.setBundleIdentifier(bundleIdentifier);
        row.setAppFileNames(appFileNames);
        row.setTopLevelApp(topLevelApp);
        row.setVulnerabilities(vulnerabilities);
        return row;
    }

    private static boolean sameContent(DeviceSoftware existing, DeviceSoftware reported) {
        return Objects.equals(existing.getName(), reported.getName())
                && Objects.equals(existing.getSource(), reported.getSource())
                && Objects.equals(existing.getVersions(), reported.getVersions())
                && Objects.equals(existing.getUpgradeCode(), reported.getUpgradeCode())
                && Objects.equals(existing.getVendor(), reported.getVendor())
                && Objects.equals(existing.getArpKeys(), reported.getArpKeys())
                && Objects.equals(existing.getPackageFamilyNames(), reported.getPackageFamilyNames())
                && Objects.equals(existing.getInstallerTypes(), reported.getInstallerTypes())
                && Objects.equals(existing.getSystemComponent(), reported.getSystemComponent())
                && Objects.equals(existing.getWingetId(), reported.getWingetId())
                && Objects.equals(existing.getBundleIdentifier(), reported.getBundleIdentifier())
                && Objects.equals(existing.getAppFileNames(), reported.getAppFileNames())
                && Objects.equals(existing.getTopLevelApp(), reported.getTopLevelApp())
                && Objects.equals(existing.getVulnerabilities(), reported.getVulnerabilities());
    }

    private static List<String> vulnerabilitiesOf(DeviceSoftware row) {
        return row.getVulnerabilities() == null ? List.of() : row.getVulnerabilities();
    }

    private static List<String> versionsOf(HostSoftwareTitle title) {
        if (title.getInstalledVersions() == null) {
            return List.of();
        }
        List<String> versions = title.getInstalledVersions().stream()
                .map(HostSoftwareInstalledVersion::getVersion)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        FleetSource fleetSource = FleetSource.of(title.getSource());
        boolean homebrew = fleetSource == FleetSource.HOMEBREW_PACKAGES || fleetSource == FleetSource.HOMEBREW_CASKS;
        return homebrew ? newestOf(versions) : versions;
    }

    // Homebrew keeps the versions it upgraded from in the Cellar: only the newest one is installed
    private static List<String> newestOf(List<String> versions) {
        return versions.stream()
                .max(SoftwareVersions::compare)
                .map(List::of)
                .orElseGet(List::of);
    }

    private static String firstOf(HostSoftwareTitle title, Function<HostSoftwareInstalledVersion, String> value) {
        return installedVersionsOf(title).stream().map(value).filter(v -> !isBlank(v)).findFirst().orElse(null);
    }

    private static List<String> valuesOf(HostSoftwareTitle title, Function<HostSoftwareInstalledVersion, String> value) {
        return installedVersionsOf(title).stream().map(value).filter(v -> !isBlank(v)).distinct().toList();
    }

    // null until a version reports the flag; true only when every reporting version has it set
    private static Boolean systemComponentOf(HostSoftwareTitle title) {
        List<Boolean> flags = installedVersionsOf(title).stream()
                .map(HostSoftwareInstalledVersion::getSystemComponent).filter(Objects::nonNull).toList();
        return flags.isEmpty() ? null : flags.stream().allMatch(Boolean::booleanValue);
    }

    private static List<String> installedPathsOf(HostSoftwareTitle title) {
        return installedVersionsOf(title).stream()
                .map(HostSoftwareInstalledVersion::getInstalledPaths)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(path -> !isBlank(path))
                .toList();
    }

    private static List<String> appFileNamesOf(List<String> installedPaths) {
        return installedPaths.stream()
                .map(APP_PATH::matcher)
                .filter(Matcher::matches)
                .map(appPath -> appPath.group(1))
                .distinct()
                .sorted()
                .toList();
    }

    // null when Fleet sent no path: unknown, which is not the same as nested
    private static Boolean topLevelAppOf(List<String> installedPaths) {
        if (installedPaths.isEmpty()) {
            return null;
        }
        return installedPaths.stream().anyMatch(path -> TOP_LEVEL_APP_PATH.matcher(path).matches());
    }

    private static List<HostSoftwareInstalledVersion> installedVersionsOf(HostSoftwareTitle title) {
        return title.getInstalledVersions() == null ? List.of() : title.getInstalledVersions();
    }

    private static List<String> vulnerabilitiesOf(HostSoftwareTitle title) {
        if (title.getInstalledVersions() == null) {
            return List.of();
        }
        return title.getInstalledVersions().stream()
                .map(HostSoftwareInstalledVersion::getVulnerabilities)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(cve -> !isBlank(cve))
                .distinct()
                .toList();
    }
}
