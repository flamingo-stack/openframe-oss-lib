package com.openframe.api.service.validation.artifact;

/**
 * Severity of a validation finding.
 * ERROR blocks the save outright; HIGH_IMPACT allows the save only with a
 * recorded human approver; WARNING is stored as metadata and never blocks.
 */
public enum ValidationSeverity { ERROR, HIGH_IMPACT, WARNING }
