import { useCallback } from 'react';
import { useTheme as useSmartXTheme, useChartColors as useSmartXChartColors } from '../ThemeContext';
export function useChartColors(){const c=useSmartXChartColors();return{...c,line:c.grid};}
export function useTheme(){const{theme,setTheme}=useSmartXTheme();const change=useCallback((mode:'light'|'dark')=>{if(mode!==theme.mode)setTheme(mode==='dark'?'midnight':'ocean');},[theme.mode,setTheme]);const toggle=useCallback(()=>change(theme.mode==='light'?'dark':'light'),[change,theme.mode]);return{theme:theme.mode,setTheme:change,toggle};}
