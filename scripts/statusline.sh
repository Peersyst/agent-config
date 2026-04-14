#!/bin/bash
set -euo pipefail
# One-line statusline: [Model] progress_bar context% | $cost | duration | cache%

stdin_data=$(cat)

IFS=$'\t' read -r model_name cost duration_ms ctx_used cache_pct < <(
    echo "$stdin_data" | jq -r '[
        .model.display_name // "Unknown",
        (try (.cost.total_cost_usd // 0 | . * 100 | floor / 100) catch 0),
        (.cost.total_duration_ms // 0),
        (try (
            if (.context_window.remaining_percentage // null) != null then
                100 - (.context_window.remaining_percentage | floor)
            elif (.context_window.context_window_size // 0) > 0 then
                (((.context_window.current_usage.input_tokens // 0) +
                  (.context_window.current_usage.cache_creation_input_tokens // 0) +
                  (.context_window.current_usage.cache_read_input_tokens // 0)) * 100 /
                 .context_window.context_window_size) | floor
            else "null" end
        ) catch "null"),
        (try (
            (.context_window.current_usage // {}) |
            if (.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0) > 0 then
                ((.cache_read_input_tokens // 0) * 100 /
                 ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))) | floor
            else 0 end
        ) catch 0)
    ] | @tsv'
)

# Fallback if jq failed
if [ -z "$model_name" ]; then
    model_name=$(echo "$stdin_data" | jq -r '.model.display_name // "Unknown"' 2>/dev/null)
    cost=$(echo "$stdin_data" | jq -r '(.cost.total_cost_usd // 0)' 2>/dev/null)
    duration_ms=$(echo "$stdin_data" | jq -r '(.cost.total_duration_ms // 0)' 2>/dev/null)
    ctx_used="" cache_pct="0"
    : "${model_name:=Unknown}" "${cost:=0}" "${duration_ms:=0}"
fi

# Short model name
short_model=$(echo "$model_name" | sed -E 's/^Claude ([0-9.]+) /\1 /; s/^Claude //')

# Progress bar
SEP='\033[2m|\033[0m'
progress_bar=""
ctx_pct=""
bar_width=12

if [ -n "$ctx_used" ] && [ "$ctx_used" != "null" ] && [ "$ctx_used" -eq "$ctx_used" ] 2>/dev/null; then
    filled=$((ctx_used * bar_width / 100))
    empty=$((bar_width - filled))

    if [ "$ctx_used" -lt 50 ]; then bar_color='\033[32m'
    elif [ "$ctx_used" -lt 80 ]; then bar_color='\033[33m'
    else bar_color='\033[31m'; fi

    progress_bar="${bar_color}"
    for ((i=0; i<filled; i++)); do progress_bar="${progress_bar}█"; done
    progress_bar="${progress_bar}\033[2m"
    for ((i=0; i<empty; i++)); do progress_bar="${progress_bar}⣿"; done
    progress_bar="${progress_bar}\033[0m"
    ctx_pct="${ctx_used}%"
fi

# Duration
session_time=""
if [ "$duration_ms" -gt 0 ] 2>/dev/null; then
    total_sec=$((duration_ms / 1000))
    hours=$((total_sec / 3600))
    minutes=$(((total_sec % 3600) / 60))
    seconds=$((total_sec % 60))
    if [ "$hours" -gt 0 ]; then session_time="${hours}h ${minutes}m"
    elif [ "$minutes" -gt 0 ]; then session_time="${minutes}m ${seconds}s"
    else session_time="${seconds}s"; fi
fi

# Build single line
line=$(printf '\033[37m🤖 [%s]\033[0m' "$short_model")

if [ -n "$progress_bar" ]; then
    line="$line $(printf '%b' "$progress_bar")"
fi
if [ -n "$ctx_pct" ]; then
    line="$line $(printf '\033[37m%s\033[0m' "$ctx_pct")"
fi
line="$line $(printf '%b \033[33m💰 $%s\033[0m' "$SEP" "$cost")"
if [ -n "$session_time" ]; then
    line="$line $(printf '%b \033[36m⏳ %s\033[0m' "$SEP" "$session_time")"
fi
if [ "$cache_pct" -gt 0 ] 2>/dev/null; then
    line="$line $(printf '%b \033[2m🔄 %s%%\033[0m' "$SEP" "$cache_pct")"
fi

printf '%b' "$line"
