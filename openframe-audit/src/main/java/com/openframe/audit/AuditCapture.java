package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditKind;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.service.AuditTenants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
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
    private static final String READS_IN_REQUEST = AuditCapture.class.getName() + ".reads";

    private final AuditTargets targets;
    private final AuditTargetRepository targetRepository;
    private final AuditOutcomeResolver outcomeResolver;
    private final AuditRecorder recorder;
    private final AuditTenants auditTenants;
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
        String targetIdBeforeCall = safely("target id", call, () -> targetIdBefore(call));
        Snapshot before = compares ? read(call, candidates, targetIdBeforeCall) : null;
        AuditContext context = safely("context", call, recorder::context);
        R result;
        try {
            result = work.run();
        } catch (Throwable failure) {
            Snapshot seen = before != null ? before : read(call, candidates, targetIdBeforeCall);
            record(call, context, () -> entry(call, candidates, targetIdBeforeCall, seen, null, null,
                    outcomeResolver.ofFailure(failure)));
            throw failure;
        }
        if (Boolean.FALSE.equals(safely("condition", call, () -> call.recordsResult().test(result)))) {
            return result;
        }
        String targetId = targetIdBeforeCall != null
                ? targetIdBeforeCall
                : safely("target id", call, () -> call.targetIdFromResult().apply(result));
        if (call.action().getKind() == AuditKind.SENSITIVE_READ && readAlreadyRecorded(call, targetId)) {
            return result;
        }
        Snapshot after = read(call, candidates, targetId);
        Snapshot current = before != null ? before : after;
        Map<String, AuditChange> changes = compares && before != null && after != null
                ? changesOf(before, after) : null;
        record(call, context, () -> entry(call, candidates, targetId, current, changes, result,
                outcomeResolver.ofResult(result)));
        return result;
    }

    private String targetIdBefore(AuditCall call) {
        String targetId = call.targetIdBeforeCall().get();
        boolean servedTenant = targetId == null && call.targetType() == AuditTargetType.TENANT
                && !call.targetIdInResult();
        return servedTenant ? auditTenants.servedTenantId() : targetId;
    }

    private AuditEntry entry(AuditCall call, List<AuditTarget<?>> candidates, String targetId, Snapshot current,
                             Map<String, AuditChange> changes, Object result, ActionOutcome outcome) {
        Map<String, Object> details = new HashMap<>(Objects.requireNonNullElse(
                safely("details", call, () -> call.detailsFromResult().apply(result)), Map.of()));
        if (changes != null && changes.isEmpty()) {
            details.put(NO_CHANGE_DETAIL, true);
        }
        boolean secretId = candidates.stream().anyMatch(AuditTarget::secretId);
        AuditEntry.AuditEntryBuilder entry = AuditEntry.builder()
                .action(call.action())
                .outcome(outcome.outcome())
                .reason(outcome.reason())
                .targetType(call.targetType())
                .tenantId(safely("tenant id", call, () -> call.tenantIdOf().apply(result)))
                .targetId(secretId && targetId != null ? Sha256.hex(targetId) : targetId)
                .details(details.isEmpty() ? null : details)
                .changes(CollectionUtils.isEmpty(changes) ? null : changes);
        if (current != null) {
            entry.targetName(current.target().nameOf(current.document()))
                    .organizationId(current.target().organizationIdOf(current.document()))
                    .deviceId(current.target().deviceIdOf(current.document()));
        }
        return entry.build();
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

    private Snapshot read(AuditCall call, List<AuditTarget<?>> candidates, String targetId) {
        if (targetId == null) {
            return null;
        }
        return safely("target read", call, () -> candidates.stream()
                .map(target -> snapshotOf(target, targetId))
                .flatMap(Optional::stream)
                .findFirst()
                .orElse(null));
    }

    private <T> Optional<Snapshot> snapshotOf(AuditTarget<T> target, String targetId) {
        return targetRepository.findOnPrimary(target, targetId).map(document -> new Snapshot(target, document));
    }

    private void record(AuditCall call, AuditContext context, Supplier<AuditEntry> entry) {
        safely("recording", call, () -> {
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

    private static <T> T safely(String step, AuditCall call, Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (RuntimeException e) {
            log.error("Audit {} failed for {}", step, call.action().getName(), e);
            return null;
        }
    }

    private record Snapshot(AuditTarget<?> target, Object document) {
    }
}
