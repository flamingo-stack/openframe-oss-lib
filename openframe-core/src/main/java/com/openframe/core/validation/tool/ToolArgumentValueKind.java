package com.openframe.core.validation.tool;

/** Describes portable value predicates without depending on a model SDK. */
public enum ToolArgumentValueKind {

    NON_NULL, HAS_TEXT, NON_EMPTY, NOT_TRIM_EMPTY, NOT_TRIM_BLANK, EQUALS, POSITIVE, MULTIPLE_OF, PATTERN
}
