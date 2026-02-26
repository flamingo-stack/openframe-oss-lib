import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import {
  DatePicker,
  DatePickerInput,
  DatePickerInputSimple,
  type DatePickerBaseProps,
  type DateRange,
} from "../components/ui/date-picker";

// Using a simplified type for Storybook since DatePicker uses discriminated union
type DatePickerStoryProps = DatePickerBaseProps & {
  mode?: "single" | "range";
};

const meta: Meta<DatePickerStoryProps> = {
  title: "UI/DatePicker",
  component: DatePicker as React.ComponentType<DatePickerStoryProps>,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "DatePicker component with single date and date range selection modes. Follows ODS design system with dark theme styling.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    mode: {
      control: "select",
      options: ["single", "range"],
      description: "Selection mode: single date or date range",
    },
    placeholder: {
      control: "text",
      description: "Placeholder text when no date is selected",
    },
    disabled: {
      control: "boolean",
      description: "Whether the picker is disabled",
    },
    numberOfMonths: {
      control: "select",
      options: [1, 2],
      description: "Number of months to display in the calendar",
    },
  },
};

export default meta;
type Story = StoryObj<DatePickerStoryProps>;

/**
 * Single date picker - default mode.
 */
export const Single: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();
    return (
      <DatePicker
        mode="single"
        placeholder="Select date"
        value={date}
        onChange={setDate}
      />
    );
  },
};

/**
 * Single date picker with a pre-selected date.
 */
export const SingleWithValue: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <DatePicker
        mode="single"
        placeholder="Select date"
        value={date}
        onChange={setDate}
      />
    );
  },
};

/**
 * Date range picker - for selecting a period.
 */
export const Range: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange | undefined>();
    return (
      <DatePicker
        mode="range"
        placeholder="Select date range"
        value={range}
        onChange={setRange}
      />
    );
  },
};

/**
 * Date range picker with pre-selected range.
 */
export const RangeWithValue: Story = {
  render: function Render() {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const [range, setRange] = useState<DateRange | undefined>({
      from: today,
      to: nextWeek,
    });
    return (
      <DatePicker
        mode="range"
        placeholder="Select date range"
        value={range}
        onChange={setRange}
      />
    );
  },
};

/**
 * Date range picker with two months displayed.
 */
export const RangeTwoMonths: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange | undefined>();
    return (
      <DatePicker
        mode="range"
        placeholder="Select date range"
        value={range}
        onChange={setRange}
        numberOfMonths={2}
      />
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "auto", minWidth: "640px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * Disabled date picker.
 */
export const Disabled: Story = {
  render: function Render() {
    return (
      <DatePicker mode="single" placeholder="Select date" disabled />
    );
  },
};

/**
 * Date picker with label.
 */
export const WithLabel: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();
    return (
      <DatePicker
        mode="single"
        placeholder="Select date"
        value={date}
        onChange={setDate}
        label="Start Date"
      />
    );
  },
};

/**
 * Date picker with label and error.
 */
export const WithLabelAndError: Story = {
  render: function Render() {
    return (
      <DatePicker
        mode="single"
        placeholder="Select date"
        label="Start Date"
        error="Please select a valid date"
      />
    );
  },
};

/**
 * Date range picker with label.
 */
export const RangeWithLabel: Story = {
  render: function Render() {
    const [range, setRange] = useState<DateRange | undefined>();
    return (
      <DatePicker
        mode="range"
        placeholder="Select date range"
        value={range}
        onChange={setRange}
        label="Period"
      />
    );
  },
};

/**
 * Date picker with custom date format.
 */
export const CustomFormat: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    return (
      <DatePicker
        mode="single"
        placeholder="Select date"
        value={date}
        onChange={setDate}
        formatDate={formatDate}
      />
    );
  },
};

/**
 * Date picker with min/max date constraints.
 */
export const WithConstraints: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);

    return (
      <DatePicker
        mode="single"
        placeholder="Select date (next 30 days)"
        value={date}
        onChange={setDate}
        fromDate={today}
        toDate={maxDate}
      />
    );
  },
};

// ============================================================================
// DatePickerInput Stories
// ============================================================================

/**
 * DatePickerInput - styled as input field with calendar icon.
 */
export const InputStyle: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();
    return (
      <DatePickerInput
        placeholder="Select date"
        value={date}
        onChange={setDate}
      />
    );
  },
};

/**
 * DatePickerInput with label.
 */
export const InputWithLabel: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();
    return (
      <div style={{ width: "320px" }}>
        <DatePickerInput
          placeholder="Select date"
          value={date}
          onChange={setDate}
          label="Event Date"
        />
      </div>
    );
  },
};

/**
 * DatePickerInput with label and error.
 */
export const InputWithLabelAndError: Story = {
  render: function Render() {
    return (
      <div style={{ width: "320px" }}>
        <DatePickerInput
          placeholder="Select date"
          label="Event Date"
          error="Date is required"
        />
      </div>
    );
  },
};

/**
 * DatePickerInput with time selector - empty initial state.
 */
export const InputWithTimeEmpty: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();

    const formatDateTime = () => {
      if (!date) return "No date selected";
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInput
          placeholder="Select date and time"
          value={date}
          onChange={setDate}
          showTime
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span> {formatDateTime()}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "560px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * DatePickerInput with time selector (separate hour/minute/period selects).
 */
export const InputWithTime: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());

    const formatDateTime = () => {
      if (!date) return "No date selected";
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInput
          placeholder="Select date"
          value={date}
          onChange={setDate}
          showTime
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span> {formatDateTime()}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "560px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * DatePickerInput with 24-hour time format.
 */
export const InputWithTime24Hour: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());

    const formatDateTime = () => {
      if (!date) return "No date selected";
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInput
          placeholder="Select date"
          value={date}
          onChange={setDate}
          showTime
          use24HourFormat
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span> {formatDateTime()}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "480px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * All DatePicker variants displayed together.
 */
export const AllVariants: Story = {
  render: function Render() {
    const [singleDate, setSingleDate] = useState<Date | undefined>();
    const [rangeDate, setRangeDate] = useState<DateRange | undefined>();
    const [inputDate, setInputDate] = useState<Date | undefined>(new Date());

    const formatSingleDate = (date: Date | undefined) => {
      if (!date) return "No date selected";
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatRangeDate = (range: DateRange | undefined) => {
      if (!range?.from) return "No range selected";
      const fromStr = range.from.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!range.to) return `${fromStr} - ...`;
      const toStr = range.to.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${fromStr} - ${toStr}`;
    };

    const formatDateTime = () => {
      if (!inputDate) return "No date selected";
      const dateStr = inputDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = inputDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          width: "560px",
        }}
      >
        <div>
          <label className="text-[14px] text-ods-text-secondary mb-2 block">
            Single Date Picker
          </label>
          <DatePicker
            mode="single"
            placeholder="Select date"
            value={singleDate}
            onChange={setSingleDate}
          />
          <div className="text-[12px] text-ods-text-secondary mt-2">
            Selected: {formatSingleDate(singleDate)}
          </div>
        </div>

        <div>
          <label className="text-[14px] text-ods-text-secondary mb-2 block">
            Date Range Picker
          </label>
          <DatePicker
            mode="range"
            placeholder="Select date range"
            value={rangeDate}
            onChange={setRangeDate}
          />
          <div className="text-[12px] text-ods-text-secondary mt-2">
            Selected: {formatRangeDate(rangeDate)}
          </div>
        </div>

        <div>
          <label className="text-[14px] text-ods-text-secondary mb-2 block">
            Date Picker with Time
          </label>
          <DatePickerInput
            placeholder="Select date"
            value={inputDate}
            onChange={setInputDate}
            showTime
          />
          <div className="text-[12px] text-ods-text-secondary mt-2">
            Selected: {formatDateTime()}
          </div>
        </div>

        <div>
          <label className="text-[14px] text-ods-text-secondary mb-2 block">
            Disabled
          </label>
          <DatePicker mode="single" placeholder="Select date" disabled />
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "560px" }}>
        <Story />
      </div>
    ),
  ],
};

// ============================================================================
// DatePickerInputSimple Stories
// ============================================================================

/**
 * DatePickerInputSimple - simplified version with single time selector dropdown.
 */
export const SimpleInputWithTime: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());

    const formatDateTime = () => {
      if (!date) return "No date selected";
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInputSimple
          placeholder="Select date"
          value={date}
          onChange={setDate}
          showTime
          timeInterval={30}
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span> {formatDateTime()}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "480px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * DatePickerInputSimple with 15-minute intervals.
 */
export const SimpleInputWithTime15Min: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());

    const formatDateTime = () => {
      if (!date) return "No date selected";
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInputSimple
          placeholder="Select date"
          value={date}
          onChange={setDate}
          showTime
          timeInterval={15}
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span> {formatDateTime()}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "480px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * DatePickerInputSimple with 24-hour format.
 */
export const SimpleInputWithTime24Hour: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>(new Date());

    const formatDateTime = () => {
      if (!date) return "No date selected";
      const dateStr = date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return `${dateStr} at ${timeStr}`;
    };

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInputSimple
          placeholder="Select date"
          value={date}
          onChange={setDate}
          showTime
          timeInterval={30}
          use24HourFormat
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span> {formatDateTime()}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "480px" }}>
        <Story />
      </div>
    ),
  ],
};

/**
 * DatePickerInputSimple without time selector.
 */
export const SimpleInputDateOnly: Story = {
  render: function Render() {
    const [date, setDate] = useState<Date | undefined>();

    return (
      <div className="flex flex-col gap-4">
        <DatePickerInputSimple
          placeholder="Select date"
          value={date}
          onChange={setDate}
        />
        <div className="text-[14px] text-ods-text-secondary p-3 bg-ods-bg rounded-lg border border-ods-border">
          <span className="text-ods-text-primary">Selected:</span>{" "}
          {date
            ? date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "No date selected"}
        </div>
      </div>
    );
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px" }}>
        <Story />
      </div>
    ),
  ],
};
