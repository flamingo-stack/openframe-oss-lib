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

    public <R> R runWithoutCompare(AuditAction action, AuditTargetType targetType, String targetId,
                                   Map<String, Object> details, Supplier<R> work) {
        return run(AuditCall.of(action, targetType, targetId, details).withCompare(false), work::get);
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
        return run(call, work::getAsBoolean);
    }

    public <R, E extends Throwable> R run(AuditCall call, AuditedWork<R, E> work) throws E {
        if (!enabled) {
            return work.run();
        }
        List<AuditTarget<?>> candidates = targets.find(call.targetType());
        boolean compares = call.compare() && call.action().getKind() == AuditKind.CHANGE;
        String targetIdBeforeCall = tryGet("target id", call, () -> targetIdBefore(call));
        LoadedTarget before = compares ? read(call, candidates, targetIdBeforeCall) : null;
        List<AuditTarget<?>> rereadCandidates = before == null ? candidates : List.of(before.target());
        AuditContext context = tryGet("context", call, recorder::context);
        String eventId = UlidCreator.getUlid().toString();
        AuditContext declared = context == null ? null : context.withParentEventId(eventId);
        writer.trackChildrenOf(eventId);
        R result;
        boolean hasChildren;
        try {
            result = recorder.runInContext(declared, work);
        } catch (Throwable failure) {
            LoadedTarget after = read(call, rereadCandidates, targetIdBeforeCall);
            Map<String, AuditChange> changes = isVersionConflict(failure)
                    ? null : changesBetween(call, compares, before, after);
            if (record(call, context, () -> entry(call, targetIdBeforeCall, firstNonNull(after, before), before,
                    changes, detailsOf(call, null), null, outcomeResolver.ofFailure(failure)).id(eventId).build())) {
                RecordedFailures.add(failure);
            }
            throw failure;
        } finally {
            hasChildren = writer.hadChildren(eventId);
        }
        ActionOutcome outcome = outcomeResolver.ofResult(result);
        boolean succeeded = outcome.outcome() == AuditOutcome.SUCCESS;
        if (succeeded && !hasChildren
                && Boolean.FALSE.equals(tryGet("condition", call, () -> call.recordsResult().test(result)))) {
            return result;
        }
        String targetId = targetIdBeforeCall != null
                ? targetIdBeforeCall
                : tryGet("target id", call, () -> call.targetIdFromResult().apply(result));
        Map<String, Object> details = detailsOf(call, result);
        String readKey = succeeded && call.action().getKind() == AuditKind.SENSITIVE_READ && targetId != null
                ? tryGet("read key", call, () -> sensitiveReadKeyOf(call, context, targetId, details)) : null;
        if (readKey != null && !hasChildren && isSensitiveReadRecorded(readKey)) {
            return result;
        }
        LoadedTarget after = read(call, rereadCandidates, targetId);
        LoadedTarget current = firstNonNull(after, before);
        Map<String, AuditChange> changes = changesBetween(call, compares, before, after);
        if (!call.recordsUnchanged() && changedNothing(changes, outcome) && !hasChildren) {
            return result;
        }
        boolean stored = record(call, context,
                () -> entry(call, targetId, current, before, changes, details, result, outcome).id(eventId).build());
        if (stored && readKey != null) {
            markSensitiveReadRecorded(readKey);
        }
        List<AuditAction> childActions = tryGet("child events", call,
                () -> childActionsToRecord(call, compares, before, after, outcome));
        Objects.requireNonNullElse(childActions, List.<AuditAction>of()).forEach(action -> record(call, declared,
                () -> entry(call.withAction(action), targetId, current, before, null, details, result, outcome).build()));
        return result;
    }

    public boolean alreadyRecorded(Throwable failure) {
        return RecordedFailures.contains(failure);
    }

    private String targetIdBefore(AuditCall call) {
        String targetId = call.targetIdBeforeCall().get();
        return call.targetIdInResult() ? targetId : writer.targetIdOf(call.targetType(), targetId);
    }

    private LoadedTarget read(AuditCall call, List<AuditTarget<?>> candidates, String targetId) {
        if (targetId == null) {
            return null;
        }
        return tryGet("target", call, () -> targetRepository.load(candidates, targetId).orElse(null));
    }

    private static boolean isVersionConflict(Throwable failure) {
        return ExceptionUtils.indexOfType(failure, OptimisticLockingFailureException.class) >= 0;
    }

    private Map<String, AuditChange> changesBetween(AuditCall call, boolean compares, LoadedTarget before, LoadedTarget after) {
        return compares && before != null && after != null
                ? tryGet("changes", call, () -> changesOf(before, after)) : null;
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
        if (before instanceof Decimal128 first && after instanceof Decimal128 second) {
            return first.compareTo(second) == 0;
        }
        if (before instanceof Map<?, ?> first && after instanceof Map<?, ?> second) {
            return first.keySet().equals(second.keySet())
                    && first.keySet().stream().allMatch(key -> sameValue(first.get(key), second.get(key)));
        }
        if (before instanceof List<?> first && after instanceof List<?> second) {
            return first.size() == second.size()
                    && IntStream.range(0, first.size()).allMatch(index -> sameValue(first.get(index), second.get(index)));
        }
        return Objects.equals(before, after);
    }

    private static boolean changedNothing(Map<String, AuditChange> changes, ActionOutcome outcome) {
        return changes != null && changes.isEmpty() && outcome.outcome() == AuditOutcome.SUCCESS;
    }

    private static Map<String, Object> detailsOf(AuditCall call, Object result) {
        return AuditEntry.builder()
                .action(call.action())
                .details(call.detailsFromResult().apply(result))
                .build()
                .plainDetails();
    }

    private static String sensitiveReadKeyOf(AuditCall call, AuditContext context, String targetId, Map<String, Object> details) {
        String storedDetails = details == null ? "" : new Document(new TreeMap<>(details)).toJson();
        String actor = context == null ? "" : context.actor().identity();
        return String.join(":", READ_RECORDED, call.action().getName(), String.valueOf(call.targetType()), targetId,
                actor, storedDetails);
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

    private boolean record(AuditCall call, AuditContext context, Supplier<AuditEntry> entry) {
        try {
            return recorder.recordAudited(entry.get(), context);
        } catch (RuntimeException e) {
            log.error("Audit event of {} not recorded", call.action().getName(), e);
            return false;
        }
    }

    private AuditEntry.AuditEntryBuilder entry(AuditCall call, String targetId, LoadedTarget current,
                                               LoadedTarget before, Map<String, AuditChange> changes,
                                               Map<String, Object> details, Object result, ActionOutcome outcome) {
        AuditEntry.AuditEntryBuilder entry = AuditEntry.builder()
                .action(call.action())
                .outcome(outcome.outcome())
                .reason(outcome.reason())
                .targetType(call.targetType())
                .tenantId(tryGet("tenant id", call, () -> call.tenantIdOf().apply(result)))
                .targetId(targetId)
                .targetTenantId(current == null ? null : current.tenantId())
                .details(CollectionUtils.isEmpty(details) ? null : details)
                .changes(CollectionUtils.isEmpty(changes) ? null : changes);
        String organizationId = firstNonNull(fromTarget(current, LoadedTarget::organizationId, "organization id", call),
                fromTarget(before, LoadedTarget::organizationId, "organization id", call));
        String deviceId = firstNonNull(fromTarget(current, LoadedTarget::deviceId, "device id", call),
                fromTarget(before, LoadedTarget::deviceId, "device id", call));
        return entry.targetName(orFromResult(fromTarget(current, LoadedTarget::name, "target name", call),
                        "target name", call, call.targetNameOf(), result))
                .organizationId(orFromResult(organizationId, "organization id", call, call.organizationIdOf(), result))
                .deviceId(orFromResult(deviceId, "device id", call, call.deviceIdOf(), result));
    }

    private static String fromTarget(LoadedTarget target, Function<LoadedTarget, String> field, String what,
                                     AuditCall call) {
        return target == null ? null : tryGet(what, call, () -> field.apply(target));
    }

    private static String orFromResult(String loaded, String what, AuditCall call,
                                       Function<Object, String> fromResult, Object result) {
        return loaded != null ? loaded : tryGet(what, call, () -> fromResult.apply(result));
    }

    private List<AuditAction> childActionsToRecord(AuditCall call, boolean compares, LoadedTarget before,
                                                   LoadedTarget after, ActionOutcome outcome) {
        boolean created = before == null && call.action().getName().endsWith(CREATE_SUFFIX);
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
                .filter(childAction -> childAction != call.action())
                .toList();
    }

    private static <T> T tryGet(String what, AuditCall call, Supplier<T> supplier) {
        try {
            return supplier.get();
        } catch (RuntimeException e) {
            log.error("Audit could not work out the {} of {}", what, call.action().getName(), e);
            return null;
        }
    }
}
