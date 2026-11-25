package com.openframe.audit;

import com.github.f4b6a3.ulid.UlidCreator;
import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRegistry;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.LoadedTarget;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditKind;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.model.audit.AuditEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.apache.commons.lang3.ObjectUtils.firstNonNull;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditedMethodRunner {

    private static final Set<String> TECHNICAL_FIELDS =
            Set.of("_id", "updatedAt", "statusChangedAt", "lastModifiedBy", "updatedBy");
    private static final AuditChange MASKED_CHANGE = new AuditChange("[changed]", "[changed]");
    private static final String HIDDEN = "[hidden]";
    private static final String INSIDE = ".";
    static final String CREATE_SUFFIX = ".create";
    private static final String READ_RECORDED = "openframe.audit.read";

    private final AuditTargetRegistry targets;
    private final AuditTargetRepository targetRepository;
    private final AuditOutcomeResolver outcomeResolver;
    private final AuditRecorder recorder;
    private final AuditEventWriter writer;
    private final AuditDocumentConverter documentConverter;
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
        return run(AuditCall.of(action, targetType, targetId, details), work::get);
    }

    public void run(AuditAction action, String targetId, Runnable work) {
        run(action, targetId, Map.of(), work);
    }

    public void run(AuditAction action, String targetId, Map<String, Object> details, Runnable work) {
        run(action, action.getTargetType(), targetId, details, work);
    }

    public void run(AuditAction action, AuditTargetType targetType, String targetId, Map<String, Object> details,
                    Runnable work) {
        run(AuditCall.of(action, targetType, targetId, details), () -> {
            work.run();
            return null;
        });
    }

    public boolean runWhenChanged(AuditAction action, AuditTargetType targetType, String targetId,
                                  Map<String, Object> details, BooleanSupplier work) {
        AuditCall auditCall = AuditCall.of(action, targetType, targetId, details)
                .withCompare(false)
                .withStoreIf(Boolean.TRUE::equals);
        return run(auditCall, work::getAsBoolean);
    }

    public <R, E extends Throwable> R run(AuditCall auditCall, AuditedWork<R, E> work) throws E {
        if (!enabled) {
            return work.run();
        }
        List<AuditTarget<?>> candidates = targets.find(auditCall.targetType());
        boolean compares = auditCall.compare() && auditCall.action().getKind() == AuditKind.CHANGE;
        String targetIdBeforeCall = tryGet("target id", auditCall, () -> targetIdBefore(auditCall));
        LoadedTarget before = compares ? read(auditCall, candidates, targetIdBeforeCall) : null;
        List<AuditTarget<?>> rereadCandidates = before == null ? candidates : List.of(before.target());
        AuditContext context = tryGet("context", auditCall, recorder::context);
        String eventId = UlidCreator.getUlid().toString();
        AuditContext declared = context == null ? null : context.withParentEventId(eventId);
        writer.trackChildrenOf(eventId);
        R result;
        boolean hasChildren;
        try {
            result = recorder.runInContext(declared, work);
        } catch (Throwable failure) {
            LoadedTarget after = read(auditCall, rereadCandidates, targetIdBeforeCall);
            Map<String, AuditChange> changes = isVersionConflict(failure)
                    ? null : changesBetween(auditCall, compares, before, after);
            if (record(auditCall, context, () -> entry(auditCall, targetIdBeforeCall, firstNonNull(after, before),
                    before, changes, detailsOf(auditCall, null), null, outcomeResolver.ofFailure(failure))
                    .id(eventId).build())) {
                RecordedFailures.add(failure);
            }
            throw failure;
        } finally {
            hasChildren = writer.hadChildren(eventId);
        }
        ActionOutcome outcome = outcomeResolver.ofResult(result);
        boolean succeeded = outcome.outcome() == AuditOutcome.SUCCESS;
        if (succeeded && !hasChildren
                && Boolean.FALSE.equals(tryGet("condition", auditCall, () -> auditCall.storeIf().test(result)))) {
            return result;
        }
        String targetId = targetIdBeforeCall != null
                ? targetIdBeforeCall
                : tryGet("target id", auditCall, () -> auditCall.targetIdFromResult().apply(result));
        Map<String, Object> details = detailsOf(auditCall, result);
        String readKey = succeeded && auditCall.action().getKind() == AuditKind.SENSITIVE_READ && targetId != null
                ? tryGet("read key", auditCall, () -> sensitiveReadKeyOf(auditCall, context, targetId, details)) : null;
        if (readKey != null && !hasChildren && isSensitiveReadRecorded(readKey)) {
            return result;
        }
        LoadedTarget after = read(auditCall, rereadCandidates, targetId);
        LoadedTarget latest = firstNonNull(after, before);
        Map<String, AuditChange> changes = auditCall.changesFromResult() == null
                ? changesBetween(auditCall, compares, before, after)
                : tryGet("changes", auditCall, () -> auditCall.changesFromResult().apply(result));
        if (changedNothing(changes, outcome) && !hasChildren
                && Boolean.FALSE.equals(tryGet("store when unchanged", auditCall,
                        () -> auditCall.storeIfUnchanged().test(result)))) {
            return result;
        }
        boolean stored = record(auditCall, context, () ->
                entry(auditCall, targetId, latest, before, changes, details, result, outcome).id(eventId).build());
        if (stored && readKey != null) {
            markSensitiveReadRecorded(readKey);
        }
        List<AuditAction> childActions = tryGet("child events", auditCall,
                () -> childActionsToRecord(auditCall, compares, before, after, outcome));
        Objects.requireNonNullElse(childActions, List.<AuditAction>of()).forEach(action -> record(auditCall, declared,
                () -> entry(auditCall.withAction(action), targetId, latest, before, null, details, result, outcome)
                        .build()));
        return result;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean alreadyRecorded(Throwable failure) {
        return RecordedFailures.contains(failure);
    }

    private String targetIdBefore(AuditCall auditCall) {
        String targetId = auditCall.targetIdBeforeCall().get();
        return auditCall.targetIdInResult() ? targetId : writer.targetIdOf(auditCall.targetType(), targetId);
    }

    private LoadedTarget read(AuditCall auditCall, List<AuditTarget<?>> candidates, String targetId) {
        if (targetId == null) {
            return null;
        }
        return tryGet("target", auditCall, () -> targetRepository.load(candidates, targetId).orElse(null));
    }

    private static boolean isVersionConflict(Throwable failure) {
        return ExceptionUtils.indexOfType(failure, OptimisticLockingFailureException.class) >= 0;
    }

    private Map<String, AuditChange> changesBetween(AuditCall auditCall, boolean compares, LoadedTarget before,
                                                    LoadedTarget after) {
        return compares && before != null && after != null
                ? tryGet("changes", auditCall, () -> changesOf(before, after)) : null;
    }

    private Map<String, AuditChange> changesOf(LoadedTarget before, LoadedTarget after) {
        AuditTarget<?> target = after.target();
        Document beforeFields = documentConverter.toDocument(before.document());
        Document afterFields = documentConverter.toDocument(after.document());
        Set<String> fields = new TreeSet<>(beforeFields.keySet());
        fields.addAll(afterFields.keySet());
        String versionField = documentConverter.versionFieldOf(after.document());
        return fields.stream()
                .filter(field -> !TECHNICAL_FIELDS.contains(field) && !field.equals(versionField)
                        && !target.ignoredFields().contains(field))
                .filter(field -> !sameValue(beforeFields.get(field), afterFields.get(field)))
                .collect(Collectors.toMap(Function.identity(),
                        field -> changeOf(target, field, beforeFields.get(field), afterFields.get(field)),
                        (first, _) -> first,
                        LinkedHashMap::new));
    }

    private static AuditChange changeOf(AuditTarget<?> target, String field, Object before, Object after) {
        if (target.maskedFields().contains(field)) {
            return MASKED_CHANGE;
        }
        String prefix = field + INSIDE;
        Set<String> secretKeys = target.maskedFields().stream()
                .filter(masked -> masked.startsWith(prefix))
                .map(masked -> masked.substring(prefix.length()))
                .collect(Collectors.toSet());
        if (secretKeys.isEmpty()) {
            return new AuditChange(before, after);
        }
        Object shownBefore = withSecretsHidden(before, secretKeys);
        Object shownAfter = withSecretsHidden(after, secretKeys);
        return sameValue(shownBefore, shownAfter) ? MASKED_CHANGE : new AuditChange(shownBefore, shownAfter);
    }

    private static Object withSecretsHidden(Object value, Set<String> secretKeys) {
        return switch (value) {
            case Map<?, ?> fields -> {
                Document shown = new Document();
                fields.forEach((key, nested) -> {
                    String name = String.valueOf(key);
                    shown.put(name, secretKeys.contains(name) ? HIDDEN : withSecretsHidden(nested, secretKeys));
                });
                yield shown;
            }
            case List<?> values -> values.stream().map(element -> withSecretsHidden(element, secretKeys)).toList();
            case null, default -> value;
        };
    }

    private static boolean sameValue(Object before, Object after) {
        if (isEmpty(before) && isEmpty(after)) {
            return true;
        }
        if (before instanceof Decimal128 first && after instanceof Decimal128 second) {
            return first.compareTo(second) == 0;
        }
        if (before instanceof Map<?, ?> first && after instanceof Map<?, ?> second) {
            return Stream.of(first.keySet(), second.keySet()).flatMap(Collection::stream).distinct()
                    .allMatch(key -> sameValue(first.get(key), second.get(key)));
        }
        if (before instanceof List<?> first && after instanceof List<?> second) {
            return first.size() == second.size()
                    && IntStream.range(0, first.size()).allMatch(index -> sameValue(first.get(index), second.get(index)));
        }
        return Objects.equals(before, after);
    }

    private static boolean isEmpty(Object value) {
        return switch (value) {
            case null -> true;
            case String text -> text.isEmpty();
            case Collection<?> items -> items.isEmpty();
            case Map<?, ?> fields -> fields.isEmpty();
            default -> false;
        };
    }

    private static boolean changedNothing(Map<String, AuditChange> changes, ActionOutcome outcome) {
        return changes != null && changes.isEmpty() && outcome.outcome() == AuditOutcome.SUCCESS;
    }

    private static Map<String, Object> detailsOf(AuditCall auditCall, Object result) {
        return AuditEntry.builder()
                .action(auditCall.action())
                .details(auditCall.detailsFromResult().apply(result))
                .build()
                .plainDetails();
    }

    private static String sensitiveReadKeyOf(AuditCall auditCall, AuditContext context, String targetId,
                                             Map<String, Object> details) {
        String storedDetails = details == null ? "" : new Document(new TreeMap<>(details)).toJson();
        String actor = context == null ? "" : context.actor().identity();
        return String.join(":", READ_RECORDED, auditCall.action().getName(), String.valueOf(auditCall.targetType()),
                targetId, actor, storedDetails);
    }

    private static boolean isSensitiveReadRecorded(String readKey) {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        return request != null && request.getAttribute(readKey, RequestAttributes.SCOPE_REQUEST) != null;
    }

    private static void markSensitiveReadRecorded(String readKey) {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request == null) {
            return;
        }
        request.setAttribute(readKey, Boolean.TRUE, RequestAttributes.SCOPE_REQUEST);
    }

    private boolean record(AuditCall auditCall, AuditContext context, Supplier<AuditEntry> entry) {
        try {
            return recorder.recordAudited(entry.get(), context);
        } catch (RuntimeException e) {
            log.error("Audit event of {} not recorded", auditCall.action().getName(), e);
            return false;
        }
    }

    private AuditEntry.AuditEntryBuilder entry(AuditCall auditCall, String targetId, LoadedTarget latest,
                                               LoadedTarget before, Map<String, AuditChange> changes,
                                               Map<String, Object> details, Object result, ActionOutcome outcome) {
        AuditEntry.AuditEntryBuilder entry = AuditEntry.builder()
                .action(auditCall.action())
                .outcome(outcome.outcome())
                .reason(outcome.reason())
                .targetType(auditCall.targetType())
                .tenantId(tryGet("tenant id", auditCall, () -> auditCall.tenantIdOf().apply(result)))
                .targetId(targetId)
                .targetTenantId(latest == null ? null : latest.tenantId())
                .details(CollectionUtils.isEmpty(details) ? null : details)
                .changes(CollectionUtils.isEmpty(changes) ? null : changes);
        LoadedTarget loadedLatest = auditCall.ignoresTargetOrganizationAndDevice() ? null : latest;
        LoadedTarget loadedBefore = auditCall.ignoresTargetOrganizationAndDevice() ? null : before;
        String organizationId = firstNonNull(
                fromTarget(loadedLatest, LoadedTarget::organizationId, "organization id", auditCall),
                fromTarget(loadedBefore, LoadedTarget::organizationId, "organization id", auditCall));
        String deviceId = firstNonNull(fromTarget(loadedLatest, LoadedTarget::deviceId, "device id", auditCall),
                fromTarget(loadedBefore, LoadedTarget::deviceId, "device id", auditCall));
        String targetName = firstNonNull(fromTarget(latest, LoadedTarget::name, "target name", auditCall),
                fromTarget(before, LoadedTarget::name, "target name", auditCall));
        return entry
                .targetName(loadedOrFromResult(targetName, "target name", auditCall, auditCall.targetNameOf(), result))
                .organizationId(loadedOrFromResult(organizationId, "organization id", auditCall,
                        auditCall.organizationIdOf(), result))
                .deviceId(loadedOrFromResult(deviceId, "device id", auditCall, auditCall.deviceIdOf(), result));
    }

    private static String fromTarget(LoadedTarget target, Function<LoadedTarget, String> field, String what,
                                     AuditCall auditCall) {
        return target == null ? null : tryGet(what, auditCall, () -> field.apply(target));
    }

    private static String loadedOrFromResult(String loaded, String what, AuditCall auditCall,
                                             Function<Object, String> fromResult, Object result) {
        return loaded != null ? loaded : tryGet(what, auditCall, () -> fromResult.apply(result));
    }

    private List<AuditAction> childActionsToRecord(AuditCall auditCall, boolean compares, LoadedTarget before,
                                                   LoadedTarget after, ActionOutcome outcome) {
        boolean created = before == null && auditCall.action().getName().endsWith(CREATE_SUFFIX);
        boolean applies = compares && after != null && (before != null || created)
                && outcome.outcome() == AuditOutcome.SUCCESS && !after.target().childActions().isEmpty();
        if (!applies) {
            return List.of();
        }
        Document beforeFields = before == null ? new Document() : documentConverter.toDocument(before.document());
        Document afterFields = documentConverter.toDocument(after.document());
        return after.target().childActions().entrySet().stream()
                .filter(childAction -> Boolean.TRUE.equals(afterFields.get(childAction.getKey()))
                        && !Boolean.TRUE.equals(beforeFields.get(childAction.getKey())))
                .map(Map.Entry::getValue)
                .filter(childAction -> childAction != auditCall.action())
                .toList();
    }

    private static <T> T tryGet(String what, AuditCall auditCall, Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (RuntimeException e) {
            log.error("Audit could not work out the {} of {}", what, auditCall.action().getName(), e);
            return null;
        }
    }
}
