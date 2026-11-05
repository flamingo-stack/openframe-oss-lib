package com.openframe.audit;

import com.github.f4b6a3.ulid.UlidCreator;
import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditKind;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.util.CollectionUtils;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;


@Slf4j
@Service
@RequiredArgsConstructor
public class AuditCapture {

    public static final String NO_CHANGE_DETAIL = "noChange";
    public static final String MASKED_VALUE = "[changed]";
    private static final Set<String> TECHNICAL_FIELDS =
            Set.of("_id", "_class", "updatedAt", "version", "statusChangedAt", "lastModifiedBy");
    private static final AuditChange MASKED_CHANGE = new AuditChange(MASKED_VALUE, MASKED_VALUE);
    private static final String CREATE_SUFFIX = ".create";
    private static final String READS_IN_REQUEST = AuditCapture.class.getName() + ".reads";

    private final AuditTargets targets;
    private final AuditTargetRepository targetRepository;
    private final AuditOutcomeResolver outcomeResolver;
    private final AuditRecorder recorder;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public <R> R run(AuditAction action, String targetId, Supplier<R> work) {
        return run(action, targetId, Map.of(), work);
    }

    public <R> R run(AuditAction action, String targetId, Map<String, Object> details, Supplier<R> work) {
        return run(action, action.getTargetType(), targetId, details, work);
    }

    public <R> R run(AuditAction action, AuditTargetType targetType, String targetId, Map<String, Object> details,
                     Supplier<R> work) {
        return capture(AuditCall.of(action, targetType, targetId, details), work::get);
    }

    public void run(AuditAction action, String targetId, Runnable work) {
        run(action, targetId, Map.of(), work);
    }

    public void run(AuditAction action, String targetId, Map<String, Object> details, Runnable work) {
        run(action, action.getTargetType(), targetId, details, work);
    }

    public void run(AuditAction action, AuditTargetType targetType, String targetId, Map<String, Object> details,
                    Runnable work) {
        capture(AuditCall.of(action, targetType, targetId, details), () -> {
            work.run();
            return null;
        });
    }

    public <R> R runWithoutCompare(AuditAction action, AuditTargetType targetType, String targetId,
                                   Map<String, Object> details, Supplier<R> work) {
        return capture(AuditCall.of(action, targetType, targetId, details).withCompare(false), work::get);
    }

    public void runWithoutCompare(AuditAction action, AuditTargetType targetType, String targetId,
                                  Map<String, Object> details, Runnable work) {
        runWithoutCompare(action, targetType, targetId, details, () -> {
            work.run();
            return null;
        });
    }

    public boolean runWhenChanged(AuditAction action, AuditTargetType targetType, String targetId,
                                  Map<String, Object> details, BooleanSupplier work) {
        AuditCall call = AuditCall.of(action, targetType, targetId, details)
                .withCompare(false)
                .withRecordsResult(Boolean.TRUE::equals);
        return capture(call, work::getAsBoolean);
    }

    public String record(AuditEntry entry) {
        Assert.state(entry.getAction() != null, "An audit entry needs an action");
        Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
        if (!enabled) {
            return null;
        }
        AuditAction action = entry.getAction();
        AuditTargetType targetType = entry.getTargetType() != null ? entry.getTargetType() : action.getTargetType();
        if (targetType == null) {
            log.error("Audit skipped: {} has no fixed target type, so the entry must name one", action.getName());
            return null;
        }
        List<AuditTarget<?>> candidates = targets.find(targetType);
        String targetId = recorder.targetIdOf(targetType, entry.getTargetId());
        AuditEntry.AuditEntryBuilder stored = entry.toBuilder().targetType(targetType).targetId(targetId);
        Snapshot current = read(action, candidates, targetId);
        if (current != null) {
            safely("target fields", action, () -> fill(stored, entry, current));
        }
        return recorder.record(stored.build());
    }

    private static Void fill(AuditEntry.AuditEntryBuilder stored, AuditEntry entry, Snapshot current) {
        AuditTarget<?> target = current.target();
        Object document = current.document();
        stored.targetName(firstNonNull(entry.getTargetName(), target.nameOf(document)))
                .organizationId(firstNonNull(entry.getOrganizationId(), target.organizationIdOf(document)))
                .deviceId(firstNonNull(entry.getDeviceId(), target.deviceIdOf(document)));
        return null;
    }

    public <R, E extends Throwable> R capture(AuditCall call, AuditedWork<R, E> work) throws E {
        if (!enabled) {
            return work.run();
        }
        if (call.targetType() == null) {
            log.error("Audit skipped: {} has no fixed target type, so the call must name one", call.action().getName());
            return work.run();
        }
        List<AuditTarget<?>> candidates = targets.find(call.targetType());
        boolean compares = call.compare() && call.action().getKind() == AuditKind.CHANGE;
        String targetIdBeforeCall = safely("target id", call.action(), () -> targetIdBefore(call));
        Snapshot before = compares ? read(call.action(), candidates, targetIdBeforeCall) : null;
        AuditContext context = safely("context", call.action(), recorder::context);
        String eventId = UlidCreator.getUlid().toString();
        AuditContext declared = context == null ? null : context.withParentEventId(eventId);
        R result;
        try {
            result = recorder.within(declared, work);
        } catch (Throwable failure) {
            Snapshot seen = before != null ? before : read(call.action(), candidates, targetIdBeforeCall);
            record(call, context, () -> entry(call, targetIdBeforeCall, seen, null, null,
                    outcomeResolver.ofFailure(failure)).id(eventId).build());
            throw failure;
        }
        if (Boolean.FALSE.equals(safely("condition", call.action(), () -> call.recordsResult().test(result)))) {
            return result;
        }
        String targetId = targetIdBeforeCall != null
                ? targetIdBeforeCall
                : safely("target id", call.action(), () -> call.targetIdFromResult().apply(result));
        if (call.action().getKind() == AuditKind.SENSITIVE_READ && readAlreadyRecorded(call, targetId)) {
            return result;
        }
        Snapshot after = read(call.action(), candidates, targetId);
        Snapshot current = before != null ? before : after;
        Map<String, AuditChange> changes = compares && before != null && after != null
                ? safely("changes", call.action(), () -> changesOf(before, after)) : null;
        ActionOutcome outcome = safely("outcome", call.action(), () -> outcomeResolver.ofResult(result));
        record(call, context, () -> entry(call, targetId, current, changes, result, outcome)
                .id(eventId).build());
        List<AuditAction> enabled = recordsEnabledFields(call, compares, before, after, outcome)
                ? safely("enabled fields", call.action(), () -> enabledActions(before, after))
                : null;
        Objects.requireNonNullElse(enabled, List.<AuditAction>of()).forEach(action -> record(call, declared,
                () -> entry(call.withAction(action), targetId, current, null, result, outcome).build()));
        return result;
    }

    private String targetIdBefore(AuditCall call) {
        String targetId = call.targetIdBeforeCall().get();
        return call.targetIdInResult() ? targetId : recorder.targetIdOf(call.targetType(), targetId);
    }

    private AuditEntry.AuditEntryBuilder entry(AuditCall call, String targetId,
                                               Snapshot current, Map<String, AuditChange> changes, Object result,
                                               ActionOutcome outcome) {
        Map<String, Object> details = new HashMap<>(Objects.requireNonNullElse(
                safely("details", call.action(), () -> call.detailsFromResult().apply(result)), Map.of()));
        if (changes != null && changes.isEmpty()) {
            details.put(NO_CHANGE_DETAIL, true);
        }
        AuditEntry.AuditEntryBuilder entry = AuditEntry.builder()
                .action(call.action())
                .outcome(outcome.outcome())
                .reason(outcome.reason())
                .targetType(call.targetType())
                .tenantId(safely("tenant id", call.action(), () -> call.tenantIdOf().apply(result)))
                .targetId(targetId)
                .details(details.isEmpty() ? null : details)
                .changes(CollectionUtils.isEmpty(changes) ? null : changes);
        String loadedName = null;
        if (current != null) {
            loadedName = current.target().nameOf(current.document());
            entry.organizationId(current.target().organizationIdOf(current.document()))
                    .deviceId(current.target().deviceIdOf(current.document()));
        }
        String name = loadedName != null
                ? loadedName
                : safely("target name", call.action(), () -> call.targetNameOf().apply(result));
        return entry.targetName(name);
    }

    private static boolean recordsEnabledFields(AuditCall call, boolean compares, Snapshot before, Snapshot after,
                                                ActionOutcome outcome) {
        boolean created = before == null && call.targetIdInResult()
                && call.action().getName().endsWith(CREATE_SUFFIX);
        return compares && after != null && (before != null || created)
                && outcome != null && outcome.outcome() == AuditOutcome.SUCCESS;
    }

    private List<AuditAction> enabledActions(Snapshot before, Snapshot after) {
        Document beforeFields = before == null ? new Document() : targetRepository.storedFieldsOf(before.document());
        Document afterFields = targetRepository.storedFieldsOf(after.document());
        return after.target().enableActions().entrySet().stream()
                .filter(enable -> Boolean.TRUE.equals(afterFields.get(enable.getKey()))
                        && !Boolean.TRUE.equals(beforeFields.get(enable.getKey())))
                .map(Map.Entry::getValue)
                .toList();
    }

    private Map<String, AuditChange> changesOf(Snapshot before, Snapshot after) {
        AuditTarget<?> target = after.target();
        Document beforeFields = targetRepository.storedFieldsOf(before.document());
        Document afterFields = targetRepository.storedFieldsOf(after.document());
        Set<String> fields = new TreeSet<>(beforeFields.keySet());
        fields.addAll(afterFields.keySet());
        return fields.stream()
                .filter(field -> !TECHNICAL_FIELDS.contains(field) && !target.ignoredFields().contains(field))
                .filter(field -> !Objects.equals(beforeFields.get(field), afterFields.get(field)))
                .collect(Collectors.toMap(Function.identity(),
                        field -> target.maskedFields().contains(field)
                                ? MASKED_CHANGE
                                : new AuditChange(beforeFields.get(field), afterFields.get(field)),
                        (first, _) -> first,
                        LinkedHashMap::new));
    }

    private Snapshot read(AuditAction action, List<AuditTarget<?>> candidates, String targetId) {
        if (targetId == null) {
            return null;
        }
        return safely("target read", action, () -> candidates.stream()
                .map(target -> snapshotOf(target, targetId))
                .flatMap(Optional::stream)
                .findFirst()
                .orElse(null));
    }

    private <T> Optional<Snapshot> snapshotOf(AuditTarget<T> target, String targetId) {
        return targetRepository.findOnPrimary(target, targetId).map(document -> new Snapshot(target, document));
    }

    private void record(AuditCall call, AuditContext context, Supplier<AuditEntry> entry) {
        safely("recording", call.action(), () -> {
            recorder.record(entry.get(), context);
            return null;
        });
    }

    @SuppressWarnings("unchecked")
    private static boolean readAlreadyRecorded(AuditCall call, String targetId) {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request == null || targetId == null) {
            return false;
        }
        Set<String> reads = (Set<String>) request.getAttribute(READS_IN_REQUEST, RequestAttributes.SCOPE_REQUEST);
        if (reads == null) {
            reads = new HashSet<>();
            request.setAttribute(READS_IN_REQUEST, reads, RequestAttributes.SCOPE_REQUEST);
        }
        return !reads.add(call.action().name() + ":" + call.targetType() + ":" + targetId);
    }

    private static <T> T safely(String step, AuditAction action, Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (RuntimeException e) {
            log.error("Audit {} failed for {}", step, action.getName(), e);
            return null;
        }
    }

    private static String firstNonNull(String value, String fallback) {
        return value != null ? value : fallback;
    }

    private record Snapshot(AuditTarget<?> target, Object document) {
    }
}
