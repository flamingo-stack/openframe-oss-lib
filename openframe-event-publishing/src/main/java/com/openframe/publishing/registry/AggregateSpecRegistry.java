
package com.openframe.publishing.registry;

import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.ResolvableType;
import org.springframework.util.ClassUtils;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * The published aggregates of a service: the spec beans and the projections of each. It answers three questions:
 * <ul>
 *   <li><b>Which spec is this aggregate type?</b> ({@code byType}) One Kafka listener and one topic per type, the backfill
 *       per type, a projection task's envelope read into the right event class ({@link #specOf(String)}), and the
 *       {@code publish} switch per type ({@link #hasSpec(String)}). Two specs for one type stop the service.</li>
 *   <li><b>A repository saved this document: which spec turns it into an event?</b> ({@code byDocument}) The publishing
 *       post-processor, its startup check and the interceptor that calls {@code toEvent}. A subclass document, such as
 *       {@code AuthUser} of {@code User}, publishes with its parent's spec. Two specs for one document stop the service.</li>
 *   <li><b>Who consumes events of this type?</b> ({@code projectionsByType}) A spec's own {@code projections()} plus every
 *       {@code Projection} bean of its event class, from libraries the spec cannot name, such as saas-lib.</li>
 * </ul>
 * A projection cannot replace a spec: the spec owns the type name (also the topic), the document class and
 * {@code toEvent}, while a projection only receives the event.
 */
@Slf4j
public class AggregateSpecRegistry {

    // Types and projection names are config keys, topic suffixes, metric tags and parts of ids joined with ":",
    // so no dots, colons, capitals or spaces.
    private static final Pattern NAME = Pattern.compile("[a-z][a-z0-9-]*");
    private static final int EVENT_TYPE_ARGUMENT = 0;

    private final Map<String, AggregateSpec<?, ?>> byType;
    private final Map<Class<?>, AggregateSpec<?, ?>> byDocument;
    private final Map<String, List<Projection<?, ?>>> projectionsByType;

    // ObjectProvider, not List: a service with no spec bean must still start.
    public AggregateSpecRegistry(ObjectProvider<AggregateSpec<?, ?>> specBeans,
                                 ObjectProvider<Projection<?, ?>> projectionBeans) {
        Map<String, AggregateSpec<?, ?>> specs = new HashMap<>();
        Map<Class<?>, AggregateSpec<?, ?>> documents = new HashMap<>();
        specBeans.stream().forEach(spec -> register(specs, documents, spec));
        this.byType = Map.copyOf(specs);
        this.byDocument = Map.copyOf(documents);
        List<Projection<?, ?>> beans = projectionBeans.stream().toList();
        this.projectionsByType = collectProjections(beans);
        requireProjections();
        Set<String> typeNames = byType.keySet();
        TreeSet<String> types = new TreeSet<>(typeNames);
        log.info("Registered {} published aggregate spec(s): {}", byType.size(), types);
    }

    // A document's repository publishes through its spec, so one spec per document as well as per type.
    private static void register(Map<String, AggregateSpec<?, ?>> specs,
                                 Map<Class<?>, AggregateSpec<?, ?>> documents,
                                 AggregateSpec<?, ?> spec) {
        String type = spec.getType();
        if (type == null || !NAME.matcher(type).matches()) {
            String specName = spec.getClass().getName();
            throw new IllegalStateException(specName + " returns the type \"" + type
                    + "\": use lower case letters, digits and dashes, for example organizations");
        }
        if (specs.putIfAbsent(type, spec) != null) {
            throw new IllegalStateException("Two specs have the type " + type);
        }
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        if (documentClass == null) {
            String specName = spec.getClass().getName();
            throw new IllegalStateException(specName + " must name its document class in AggregateSpec<D, E>");
        }
        if (documents.putIfAbsent(documentClass, spec) != null) {
            throw new IllegalStateException("Two specs publish " + documentClass.getName());
        }
    }

    public Collection<AggregateSpec<?, ?>> specs() {
        return byType.values();
    }

    public Set<String> types() {
        return byType.keySet();
    }

    // Every projection of every spec, for the jobs that run per projection.
    public List<Projection<?, ?>> projections() {
        return projectionsByType.values().stream()
                .flatMap(List::stream)
                .toList();
    }

    public List<Projection<?, ?>> getProjections(String type) {
        return projectionsByType.getOrDefault(type, List.of());
    }

    // The same projection can be both in projections() and a bean; it counts once. A bean of an event no spec has is a mistake.
    private Map<String, List<Projection<?, ?>>> collectProjections(List<Projection<?, ?>> beans) {
        Map<Class<?>, String> typeByEvent = new HashMap<>();
        Map<String, List<Projection<?, ?>>> byTypeName = new HashMap<>();
        for (AggregateSpec<?, ?> spec : byType.values()) {
            String type = spec.getType();
            Class<?> eventClass = PublishedDocuments.eventClassOf(spec);
            String typeWithSameEvent = typeByEvent.putIfAbsent(eventClass, type);
            if (typeWithSameEvent != null) {
                String eventName = eventClass.getName();
                throw new IllegalStateException("The specs of " + typeWithSameEvent + " and " + type + " have the same event class "
                        + eventName + ", so a Projection bean of it would not know its type");
            }
            List<Projection<?, ?>> own = new ArrayList<>(spec.projections());
            byTypeName.put(type, own);
        }
        for (Projection<?, ?> bean : beans) {
            Class<?> eventClass = resolveEventClass(bean);
            String type = typeByEvent.get(eventClass);
            if (type == null) {
                String projectionName = bean.getClass().getName();
                throw new IllegalStateException(projectionName + " projects " + eventClass + ", which no published aggregate spec has");
            }
            List<Projection<?, ?>> projections = byTypeName.get(type);
            boolean listed = projections.stream().anyMatch(projection -> projection == bean);
            if (!listed) {
                projections.add(bean);
            }
        }
        Map<String, List<Projection<?, ?>>> copies = new HashMap<>();
        byTypeName.forEach((type, projections) -> copies.put(type, List.copyOf(projections)));
        return Map.copyOf(copies);
    }

    private static Class<?> resolveEventClass(Projection<?, ?> projection) {
        Class<?> projectionClass = ClassUtils.getUserClass(projection);
        ResolvableType projectionType = ResolvableType.forClass(projectionClass).as(Projection.class);
        return projectionType.getGeneric(EVENT_TYPE_ARGUMENT).resolve();
    }

    // Each spec has a projection, and each projection name is unique: it is a mode key, a job id and a metric tag.
    private void requireProjections() {
        Set<String> names = new HashSet<>();
        for (AggregateSpec<?, ?> spec : byType.values()) {
            String specType = spec.getType();
            List<Projection<?, ?>> projections = getProjections(specType);
            if (projections.isEmpty()) {
                String typeName = spec.getType();
                throw new IllegalStateException("The spec of " + typeName + " has no projection: a published type is copied somewhere");
            }
            for (Projection<?, ?> projection : projections) {
                String name = projection.name();
                if (name == null || !NAME.matcher(name).matches()) {
                    String projectionName = projection.getClass().getName();
                    throw new IllegalStateException(projectionName + " is named \"" + name
                            + "\": use lower case letters, digits and dashes, for example organization-on-tickets");
                }
                if (!names.add(name)) {
                    throw new IllegalStateException("Two projections are named " + name);
                }
            }
        }
    }

    public boolean hasSpec(String type) {
        return byType.containsKey(type);
    }

    // A subclass document, such as AuthUser of User, shares its parent's collection and publishes with its spec.
    public boolean hasSpecForDocument(Class<?> documentClass) {
        List<AggregateSpec<?, ?>> specs = findSpecsForDocument(documentClass);
        return !specs.isEmpty();
    }

    public AggregateSpec<?, ?> specOfDocument(Class<?> documentClass) {
        List<AggregateSpec<?, ?>> specs = findSpecsForDocument(documentClass);
        String documentName = documentClass.getName();
        if (specs.isEmpty()) {
            throw new IllegalStateException("No published aggregate spec for the document " + documentName);
        }
        if (specs.size() > 1) {
            throw new IllegalStateException("Several published aggregate specs fit the document " + documentName);
        }
        return specs.getFirst();
    }

    private List<AggregateSpec<?, ?>> findSpecsForDocument(Class<?> documentClass) {
        AggregateSpec<?, ?> exact = byDocument.get(documentClass);
        if (exact != null) {
            return List.of(exact);
        }
        return byDocument.entrySet().stream()
                .filter(entry -> entry.getKey().isAssignableFrom(documentClass))
                .<AggregateSpec<?, ?>>map(Map.Entry::getValue)
                .toList();
    }

    public AggregateSpec<?, ?> specOf(String type) {
        AggregateSpec<?, ?> spec = byType.get(type);
        if (spec == null) {
            throw new IllegalStateException("No published aggregate spec for " + type);
        }
        return spec;
    }
}
