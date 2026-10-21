package com.openframe.core.validation.tool;

import lombok.Value;
import lombok.experimental.Accessors;

import java.util.function.Function;

/** Connects a model-visible field with its typed argument accessor. */
@Value
@Accessors(fluent = true)
public class ToolArgumentProperty<T, V> {

    private final String name;
    private final Function<T, V> accessor;

}
