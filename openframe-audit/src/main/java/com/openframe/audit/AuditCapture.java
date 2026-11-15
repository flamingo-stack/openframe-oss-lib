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
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.WeakHashMap;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.ObjectUtils.firstNonNull;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditCapture {

    private static final Set<String> TECHNICAL_FIELDS =
            Set.of("_id", "_class", "updatedAt", "version", "statusChangedAt", "lastModifiedBy");
    private static final AuditChange MASKED_CHANGE = new AuditChange("[changed]", "[changed]");
    private static final String CREATE_SUFFIX = ".create";
    private static final String READ_RECORDED = "openframe.audit.read";
    private static final Set<Throwable> RECORDED_FAILURES = Collections.synchronizedSet(Collections.newSetFromMap(new WeakHashMap<>()));

    private final AuditTargetRegistry targets;
    private final AuditTargetRepository targetRepository;
    private final AuditOutcomeResolver outcomeResolver;
    private final AuditRecorder recorder;
    private final AuditEventWriter writer;
    private final MongoConverter mongoConverter;
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
        AuditContext context = tryGet("context", call, recorder::context);
        String eventId = UlidCreator.getUlid().toString();
        AuditContext declared = context == null ? null : context.withParentEventId(eventId);
        R result;
        try {
            result = recorder.runInContext(declared, work);
        } catch (Throwable failure) {
            LoadedTarget current = before != null ? before : read(call, candidates, targetIdBeforeCall);
            record(call, context, () -> entry(call, targetIdBeforeCall, current, null, null,
                    outcomeResolver.ofFailure(failure)).id(eventId).build());
            RECORDED_FAILURES.add(failure);
            throw failure;
        }
        if (Boolean.FALSE.equals(tryGet("condition", call, () -> call.recordsResult().test(result)))) {
            return result;
        }
        String targetId = targetIdBeforeCall != null
                ? targetIdBeforeCall
                : tryGet("target id", call, () -> call.targetIdFromResult().apply(result));
        if (call.action().getKind() == AuditKind.SENSITIVE_READ && readAlreadyRecorded(call, targetId)) {
            return result;
        }
        LoadedTarget after = read(call, candidates, targetId);
        LoadedTarget current = firstNonNull(after, before);
        Map<String, AuditChange> changes = compares && before != null && after != null
                ? tryGet("changes", call, () -> changesOf(before, after)) : null;
        ActionOutcome outcome = tryGet("outcome", call, () -> outcomeResolver.ofResult(result));
        if (outcome == null || (changedNothing(changes, outcome) && !writer.hasChildren(eventId))) {
            return result;
        }
        record(call, context, () -> entry(call, targetId, current, changes, result, outcome)
                .id(eventId).build());
        List<AuditAction> childActions = tryGet("child events", call,
                () -> childActionsToRecord(call, compares, before, after, outcome));
        Objects.requireNonNullElse(childActions, List.<AuditAction>of()).forEach(action -> record(call, declared,
                () -> entry(call.withAction(action), targetId, current, null, result, outcome).build()));
        return result;
    }

    public boolean alreadyRecorded(Throwable failure) {
        return RECORDED_FAILURES.contains(failure) || RECORDED_FAILURES.contains(failure.getCause());
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

    private static boolean readAlreadyRecorded(AuditCall call, String targetId) {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request == null || targetId == null) {
            return false;
        }
        String mark = READ_RECORDED + ":" + call.action().getName() + ":" + targetId;
        if (request.getAttribute(mark, RequestAttributes.SCOPE_REQUEST) != null) {
            return true;
        }
        request.setAttribute(mark, Boolean.TRUE, RequestAttributes.SCOPE_REQUEST);
        return false;
    }

    private Map<String, AuditChange> changesOf(LoadedTarget before, LoadedTarget after) {
        AuditTarget<?> target = after.target();
        Document beforeFields = storedFieldsOf(before.document());
        Document afterFields = storedFieldsOf(after.document());
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

    private Document storedFieldsOf(Object document) {
        Document fields = new Document();
        mongoConverter.write(document, fields);
        return fields;
    }

    private static boolean changedNothing(Map<String, AuditChange> changes, ActionOutcome outcome) {
        return changes != null && changes.isEmpty() && outcome.outcome() == AuditOutcome.SUCCESS;
    }

    private void record(AuditCall call, AuditContext context, Supplier<AuditEntry> entry) {
        try {
            recorder.recordCaptured(entry.get(), context);
        } catch (RuntimeException e) {
            log.error("Audit event of {} not recorded", call.action().getName(), e);
        }
    }

    private AuditEntry.AuditEntryBuilder entry(AuditCall call, String targetId,
                                               LoadedTarget current, Map<String, AuditChange> changes, Object result,
                                               ActionOutcome outcome) {
        Map<String, Object> details = tryGet("details", call, () -> call.detailsFromResult().apply(result));
        AuditEntry.AuditEntryBuilder entry = AuditEntry.builder()
                .action(call.action())
                .outcome(outcome.outcome())
                .reason(outcome.reason())
                .targetType(call.targetType())
                .tenantId(tryGet("tenant id", call, () -> call.tenantIdOf().apply(result)))
                .targetId(targetId)
                .details(CollectionUtils.isEmpty(details) ? null : details)
                .changes(CollectionUtils.isEmpty(changes) ? null : changes);
        return entry.targetName(fromTargetOrResult(current, LoadedTarget::name, "target name", call, call.targetNameOf(), result))
                .organizationId(fromTargetOrResult(current, LoadedTarget::organizationId, "organization id", call, call.organizationIdOf(), result))
                .deviceId(fromTargetOrResult(current, LoadedTarget::deviceId, "device id", call, call.deviceIdOf(), result));
    }

    private static String fromTargetOrResult(LoadedTarget current, Function<LoadedTarget, String> fromTarget, String what, AuditCall call, Function<Object, String> fromResult, Object result) {
        String loaded = current == null ? null : fromTarget.apply(current);
        return loaded != null ? loaded : tryGet(what, call, () -> fromResult.apply(result));
    }

    private List<AuditAction> childActionsToRecord(AuditCall call, boolean compares, LoadedTarget before,
                                                   LoadedTarget after, ActionOutcome outcome) {
        boolean created = before == null && call.targetIdInResult()
                && call.action().getName().endsWith(CREATE_SUFFIX);
        boolean applies = compares && after != null && (before != null || created)
                && outcome.outcome() == AuditOutcome.SUCCESS;
        if (!applies) {
            return List.of();
        }
        Document beforeFields = before == null ? new Document() : storedFieldsOf(before.document());
        Document afterFields = storedFieldsOf(after.document());
        return after.target().childActions().entrySet().stream()
                .filter(childAction -> Boolean.TRUE.equals(afterFields.get(childAction.getKey()))
                        && !Boolean.TRUE.equals(beforeFields.get(childAction.getKey())))
                .map(Map.Entry::getValue)
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
