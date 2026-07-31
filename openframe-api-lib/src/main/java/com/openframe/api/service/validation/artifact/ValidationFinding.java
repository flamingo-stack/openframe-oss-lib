package com.openframe.api.service.validation.artifact;

/**
 * One concrete outcome of a validation check: what was found ({@code code},
 * {@code message}) and how it affects the save ({@code severity}).
 */
public record ValidationFinding(ValidationSeverity severity, String code, String message) {
}
