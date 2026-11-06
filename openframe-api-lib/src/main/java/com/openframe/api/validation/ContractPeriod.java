package com.openframe.api.validation;

import java.time.LocalDate;

public interface ContractPeriod {

    LocalDate contractStartDate();

    LocalDate contractEndDate();
}
