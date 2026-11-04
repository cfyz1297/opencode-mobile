import Svg, { Circle } from "react-native-svg"
import { TouchableOpacity } from "react-native"
import { fillColor } from "../../lib/session-stats"

interface Props {
  /** Context window used, 0..100. */
  percent: number
  isDark: boolean
  active: boolean
  onPress: () => void
  accessibilityLabel: string
}

const SIZE = 22
const STROKE = 2.5
const R = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

/**
 * Session-info toggle drawn as a ring that fills with context usage. Replaces
 * the stats-chart glyph: the number lived one tap away, the ring answers "how
 * full is the window" from the header itself.
 */
export function ContextRing({ percent, isDark, active, onPress, accessibilityLabel }: Props) {
  const filled = Math.max(0, Math.min(100, percent))
  const color = active ? fillColor(filled) : isDark ? "#888888" : "#666666"
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID="session-info-button"
    >
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={isDark ? "#333333" : "#e0e0e0"}
          strokeWidth={STROKE}
          fill="none"
        />
        {filled > 0 && (
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - filled / 100)}
            // Start the arc at 12 o'clock instead of 3 o'clock.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        )}
        {/* A dot marks the centre so an empty ring still reads as a control and
            not as a stray outline; it takes the fill colour once usage is known. */}
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={2} fill={filled > 0 ? color : isDark ? "#555555" : "#bbbbbb"} />
      </Svg>
    </TouchableOpacity>
  )
}
