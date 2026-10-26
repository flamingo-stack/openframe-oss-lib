
package com.openframe.publishing.registry;

import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.api.spec.Projection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

// Collects the spec beans by aggregate type: two specs for one type stop the service, and hasSpec tells which types can publish.
@Slf4j
public class AggregateSpecRegistry {

    // Types and projection names are config keys, topic suffixes, metric tags and parts of ids joined with ":",
    // so no dots, colons, capitals or spaces.
    private static final Pattern NAME = Pattern.compile("[a-z][a-z0-9-]*");

    private final Map<String, AggregateSpec<?, ?>> byType;
    private final Map<Class<?>, AggregateSpec<?, ?>> byDocument;

    // ObjectProvider, not List: a service with no spec bean must still start.
    public AggregateSpecRegistry(ObjectProvider<AggregateSpec<?, ?>> specBeans) {
        Map<String, AggregateSpec<?, ?>> specs = new HashMap<>();
        Map<Class<?>, AggregateSpec<?, ?>> documents = new HashMap<>();
        specBeans.stream().forEach(spec -> register(specs, documents, spec));
        this.byType = Map.copyOf(specs);
        this.byDocument = Map.copyOf(documents);
        requireProjections();
        Set<String> typeNames = byType.keySet();
        TreeSet<String> types = new TreeSet<>(typeNames);
        log.info("Registered {} published aggregate spec(s): {}", byType.size(), types);
    }

    // A document's repository publishes through its spec, so one spec per document as well as per type.
    private static void register(Map<String, AggregateSpec<?, ?>> specs, Map<Class<?>, AggregateSpec<?, ?>> documents,
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
        return byType.values().stream()
                .<Projection<?, ?>>flatMap(spec -> spec.projections().stream())
                .toList();
    }

    // The type whose events the projection applies.
    public String resolveType(Projection<?, ?> projection) {
        for (AggregateSpec<?, ?> spec : byType.values()) {
            if (spec.projections().contains(projection)) {
                return spec.getType();
            }
        }
        throw new IllegalArgumentException("No spec has the projection " + projection.name());
    }

    // Each spec has a projection, and each projection name is unique: it is a mode key, a job id and a metric tag.
    private void requireProjections() {
        Set<String> names = new HashSet<>();
        for (AggregateSpec<?, ?> spec : byType.values()) {
            List<? extends Projection<?, ?>> projections = spec.projections();
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

    public boolean hasSpecForDocument(Class<?> documentClass) {
        return byDocument.containsKey(documentClass);
    }

    public AggregateSpec<?, ?> specOfDocument(Class<?> documentClass) {
        AggregateSpec<?, ?> spec = byDocument.get(documentClass);
        if (spec == null) {
            String documentName = documentClass.getName();
            throw new IllegalStateException("No published aggregate spec for the document " + documentName);
        }
        return spec;
    }

    public AggregateSpec<?, ?> specOf(String type) {
        AggregateSpec<?, ?> spec = byType.get(type);
        if (spec == null) {
            throw new IllegalStateException("No published aggregate spec for " + type);
        }
        return spec;
    }
}
