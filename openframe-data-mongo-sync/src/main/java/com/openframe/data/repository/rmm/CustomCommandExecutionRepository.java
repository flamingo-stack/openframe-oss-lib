package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.CommandExecution;

public interface CustomCommandExecutionRepository {

    void applyResult(CommandExecution row);
}
