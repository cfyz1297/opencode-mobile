package cc.agentlabs.opencode

import android.os.Build
import android.os.Bundle
import android.view.View

import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  /** Last reported IME height in dp; -1 means "nothing reported yet". */
  private var reportedImeDp = -1f

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    installImeReporter()
  }

  /**
   * Shrinks the app's root view to sit above the soft keyboard, and reports the
   * IME height to JS as the `imeInset` device event.
   *
   * Both halves are needed, and neither can be done in JS alone:
   *
   * - Under edge-to-edge the window never resizes for the IME, so the React
   *   surface keeps its full height and draws behind the keyboard. Padding the
   *   content view is the only place where "above the keyboard" is exact;
   *   padding inside JS left the surface full-height, so a slice of the screen
   *   still slid under the keyboard.
   * - React Native's own keyboardDidShow/keyboardDidHide never fire here: they
   *   come from ReactRootView's global-layout listener, which bails out when
   *   mReactInstanceManager is null — always the case under bridgeless, which
   *   this app runs on.
   * - RN `Modal`s are separate windows that the content padding does not
   *   reach, so they still need the reported height.
   *
   * Keep this in sync with `src/lib/use-keyboard-height.ts`
   * (`imeInset` + `{height, visible}`).
   */
  private fun installImeReporter() {
    val content = findViewById<View>(android.R.id.content) ?: return
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
      if (view.paddingBottom != imeBottom) view.updatePadding(bottom = imeBottom)
      reportIme(imeBottom)
      // Never consume: the rest of the view tree still needs these insets.
      insets
    }
    ViewCompat.requestApplyInsets(content)
  }

  /** @param px IME inset in physical pixels, 0 when the keyboard is hidden. */
  private fun reportIme(px: Int) {
    val heightDp = px / resources.displayMetrics.density
    val context = (application as? ReactApplication)?.reactHost?.currentReactContext ?: return
    if (heightDp == reportedImeDp) return
    reportedImeDp = heightDp
    val payload = Arguments.createMap()
    payload.putDouble("height", heightDp.toDouble())
    payload.putBoolean("visible", heightDp > 0f)
    context.emitDeviceEvent("imeInset", payload)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
