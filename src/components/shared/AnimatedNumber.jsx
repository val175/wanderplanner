import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

/**
 * AnimatedNumber — smoothly counts to `value` using spring physics.
 *
 * Props:
 *   value      {number}  Target value to animate to
 *   decimals   {number}  Decimal places to display (default 0)
 *   prefix     {string}  e.g. "$"
 *   suffix     {string}  e.g. "%"
 *   className  {string}  Applied to the wrapping motion.span
 *   stiffness  {number}  Spring stiffness (default 80 — smooth glide)
 *   damping    {number}  Spring damping  (default 20)
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  stiffness = 80,
  damping = 20,
}) {
  const spring = useSpring(value, { stiffness, damping })
  const display = useTransform(spring, (v) =>
    `${prefix}${v.toFixed(decimals)}${suffix}`
  )

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span className={className}>{display}</motion.span>
}
