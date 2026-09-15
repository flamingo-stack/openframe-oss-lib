package com.openframe.api.dto.ticket;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTicketStatusInput {
    @NotBlank
    private String id;
    @Size(max = 32)
    private String name;
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "color must be a 6-digit hex like #1A2B3C")
    private String color;
    @Min(value = 1, message = "staleAfterMinutes must be at least 1")
    @Max(value = 43200, message = "staleAfterMinutes must be at most 30 days")
    private Integer staleAfterMinutes;
}
