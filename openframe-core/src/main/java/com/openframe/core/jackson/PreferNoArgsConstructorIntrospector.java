package com.openframe.core.jackson;

import com.fasterxml.jackson.annotation.JsonCreator;
import tools.jackson.databind.cfg.MapperConfig;
import tools.jackson.databind.introspect.Annotated;
import tools.jackson.databind.introspect.AnnotatedConstructor;
import tools.jackson.databind.introspect.JacksonAnnotationIntrospector;

import java.util.Arrays;

/**
 * Restores the Jackson 2 choice of constructor: a class that has a no-args constructor is read through it and its
 * setters, even when it also has a constructor with arguments.
 * <p>
 * Jackson 3 binds through such a constructor whenever parameter names are available ({@code -parameters}), which
 * drops field initializers and {@code @Builder.Default} values for properties missing from the JSON — for example
 * the {@code type} of chat history stored before the field existed. Records, explicit {@code @JsonCreator}s and
 * classes with no no-args constructor are left to Jackson's own detection.
 */
public class PreferNoArgsConstructorIntrospector extends JacksonAnnotationIntrospector {

    @Override
    public JsonCreator.Mode findCreatorAnnotation(MapperConfig<?> config, Annotated annotated) {
        JsonCreator.Mode explicit = super.findCreatorAnnotation(config, annotated);
        if (explicit != null || !(annotated instanceof AnnotatedConstructor constructor)
                || constructor.getParameterCount() == 0) {
            return explicit;
        }
        Class<?> type = constructor.getDeclaringClass();
        if (type.isRecord() || !hasNoArgsConstructor(type)) {
            return null;
        }
        return JsonCreator.Mode.DISABLED;
    }

    private static boolean hasNoArgsConstructor(Class<?> type) {
        return Arrays.stream(type.getDeclaredConstructors()).anyMatch(c -> c.getParameterCount() == 0);
    }
}
