import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './index'

// Typed hooks for use throughout the app
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
