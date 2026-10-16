#feature-id Utilities > ImageIntegration XISF Packager
#feature-info Saves the three standard ImageIntegration outputs or the two Drizzle Integration outputs into one multi-image XISF file.
/*
 * PackImageIntegrationXISF.js
 *
 * Packs outputs from one selected workflow into a multi-image XISF.
 * Standard ImageIntegration: integration + rejection_low + rejection_high
 * Drizzle Integration:      drizzle_integration + drizzle_weights
 *
 * If outputs from both workflows are open, each mode auto-detects and selects
 * only the matching set. Review the suggested windows before saving.
 * The source windows are not modified.
 */
#include <pjsr/Sizer.jsh>

function getImageWindows()
{
   var result = [];
   var all = ImageWindow.windows;
   for ( var i = 0; i < all.length; ++i )
      if ( !all[i].isNull && !all[i].mainView.isNull )
         result.push( all[i] );
   return result;
}

function normalizeId( s )
{
   return String( s ).toLowerCase().replace( /[^a-z0-9]/g, "" );
}

function findNamedIndex( wins, tokens )
{
   if ( !(tokens instanceof Array) )
      tokens = [ tokens ];
   var normalized = [];
   for ( var t = 0; t < tokens.length; ++t )
      normalized.push( normalizeId( tokens[t] ) );

   // Prefer exact normalized matches.
   for ( var i = 0; i < wins.length; ++i )
   {
      var id = normalizeId( wins[i].mainView.id );
      for ( var j = 0; j < normalized.length; ++j )
         if ( id == normalized[j] )
            return i;
   }
   // Otherwise use partial matches.
   for ( var k = 0; k < wins.length; ++k )
   {
      var candidate = normalizeId( wins[k].mainView.id );
      for ( var m = 0; m < normalized.length; ++m )
         if ( normalized[m].length > 0 && candidate.indexOf( normalized[m] ) >= 0 )
            return k;
   }
   return -1;
}

function defaultIndex( wins, tokens )
{
   var i = findNamedIndex( wins, tokens );
   return i >= 0 ? i : 0;
}

function findNamedIndexExcluding( wins, tokens, excluded )
{
   if ( !(tokens instanceof Array) )
      tokens = [ tokens ];
   var normalized = [];
   for ( var t = 0; t < tokens.length; ++t )
      normalized.push( normalizeId( tokens[t] ) );

   // Search by token priority first, so specific process names win over generic ones.
   for ( var j = 0; j < normalized.length; ++j )
      for ( var i = 0; i < wins.length; ++i )
      {
         if ( excluded && excluded.indexOf( i ) >= 0 )
            continue;
         if ( normalizeId( wins[i].mainView.id ) == normalized[j] )
            return i;
      }

   for ( var k = 0; k < normalized.length; ++k )
      for ( var q = 0; q < wins.length; ++q )
      {
         if ( excluded && excluded.indexOf( q ) >= 0 )
            continue;
         var id = normalizeId( wins[q].mainView.id );
         if ( normalized[k].length > 0 && id.indexOf( normalized[k] ) >= 0 )
            return q;
      }
   return -1;
}

function sameDimensions( a, b )
{
   return a.width == b.width && a.height == b.height;
}

function sameGeometryAndChannels( a, b )
{
   return sameDimensions( a, b ) && a.numberOfChannels == b.numberOfChannels;
}

function trailingNumberRemoved( id )
{
   return normalizeId( id ).replace( /[0-9]+$/, "" );
}

/*
 * Infer the five possible outputs across both processes. Rejection maps are identified
 * by their IDs first; the weight map is identified by drizzle_weights/WeightMap.
 * The standard integration should share dimensions/channels with both rejection
 * maps, while the Drizzle Integration image should normally share dimensions
 * with the weights image. Image IDs and proximity are used only as tie-breakers.
 * Returns [standard integration, rejection low, rejection high,
 *           drizzle integration, drizzle weights], using -1 for unknowns.
 */
function inferCombinedIndices( wins )
{
   var result = [ -1, -1, -1, -1, -1 ];
   var used = [];

   result[1] = findNamedIndexExcluding( wins,
      [ "rejection_low", "rejectionlow", "rejectionmaplow", "lowrejection", "lowreject" ], used );
   if ( result[1] >= 0 ) used.push( result[1] );

   result[2] = findNamedIndexExcluding( wins,
      [ "rejection_high", "rejectionhigh", "rejectionmaphigh", "highrejection", "highreject" ], used );
   if ( result[2] >= 0 ) used.push( result[2] );

   result[4] = findNamedIndexExcluding( wins,
      [ "drizzle_weights", "drizzleweights", "weightmap", "weights" ], used );
   if ( result[4] >= 0 ) used.push( result[4] );

   var candidates = [];
   for ( var c = 0; c < wins.length; ++c )
      if ( used.indexOf( c ) < 0 )
         candidates.push( c );

   // Pick the standard Integration by how well it matches both rejection maps.
   var standardIndex = -1;
   var standardScore = -1e9;
   for ( var s = 0; s < candidates.length; ++s )
   {
      var si = candidates[s];
      var simage = wins[si].mainView.image;
      var score = 0;
      if ( result[1] >= 0 )
      {
         var lowImage = wins[result[1]].mainView.image;
         if ( sameGeometryAndChannels( simage, lowImage ) ) score += 120;
         else if ( sameDimensions( simage, lowImage ) ) score += 55;
         else score -= 90;
      }
      if ( result[2] >= 0 )
      {
         var highImage = wins[result[2]].mainView.image;
         if ( sameGeometryAndChannels( simage, highImage ) ) score += 120;
         else if ( sameDimensions( simage, highImage ) ) score += 55;
         else score -= 90;
      }
      var sid = normalizeId( wins[si].mainView.id );
      if ( sid.indexOf( "drizzle" ) >= 0 || sid.indexOf( "weight" ) >= 0 ) score -= 80;
      // In the common case MasterLight and MasterLight1 are the standard and
      // drizzle products respectively, prefer the unsuffixed ID for standard.
      var root = trailingNumberRemoved( wins[si].mainView.id );
      var hasSuffixedTwin = false;
      var hasUnsuffixedTwin = false;
      for ( var st = 0; st < candidates.length; ++st )
      {
         if ( candidates[st] == si ) continue;
         if ( trailingNumberRemoved( wins[candidates[st]].mainView.id ) == root )
         {
            if ( normalizeId( wins[candidates[st]].mainView.id ) != root ) hasSuffixedTwin = true;
            else hasUnsuffixedTwin = true;
         }
      }
      if ( hasSuffixedTwin && normalizeId( wins[si].mainView.id ) == root ) score += 12;
      if ( hasUnsuffixedTwin && normalizeId( wins[si].mainView.id ) != root ) score -= 12;
      if ( score > standardScore )
      {
         standardScore = score;
         standardIndex = si;
      }
   }
   if ( standardIndex >= 0 && ( result[1] >= 0 || result[2] >= 0 ) )
   {
      result[0] = standardIndex;
      used.push( standardIndex );
   }

   // Drizzle Integration should match the weight-map dimensions; if dimensions
   // are tied, use shared ID roots and adjacency as weak clues only.
   var drizzleIndex = -1;
   var drizzleScore = -1e9;
   for ( var d = 0; d < candidates.length; ++d )
   {
      var di = candidates[d];
      if ( di == result[0] ) continue;
      var dimage = wins[di].mainView.image;
      var dscore = 0;
      if ( result[4] >= 0 )
      {
         var weightsImage = wins[result[4]].mainView.image;
         if ( sameDimensions( dimage, weightsImage ) ) dscore += 130;
         else dscore -= 100;
      }
      var did = normalizeId( wins[di].mainView.id );
      if ( did.indexOf( "drizzle" ) >= 0 ) dscore += 80;
      if ( did.indexOf( "weight" ) >= 0 || did.indexOf( "rejection" ) >= 0 ) dscore -= 100;
      if ( result[0] >= 0 && trailingNumberRemoved( wins[di].mainView.id ) == trailingNumberRemoved( wins[result[0]].mainView.id ) )
      {
         if ( did != trailingNumberRemoved( wins[di].mainView.id ) ) dscore += 18;
         else dscore -= 10;
      }
      if ( result[4] >= 0 )
      {
         if ( Math.abs( di - result[4] ) == 1 ) dscore += 18;
         else dscore -= Math.min( 10, Math.abs( di - result[4] ) );
      }
      if ( result[0] >= 0 )
      {
         var stdImage = wins[result[0]].mainView.image;
         var stdArea = stdImage.width * stdImage.height;
         var drizzleArea = dimage.width * dimage.height;
         if ( drizzleArea > stdArea ) dscore += 12;
         if ( drizzleArea == stdArea && sameGeometryAndChannels( dimage, stdImage ) ) dscore -= 2;
      }
      if ( dscore > drizzleScore )
      {
         drizzleScore = dscore;
         drizzleIndex = di;
      }
   }
   if ( drizzleIndex >= 0 && drizzleIndex != result[0] )
      result[3] = drizzleIndex;

   // For a Drizzle-only pair, there may be no rejection maps and only two windows.
   if ( result[3] < 0 && result[4] >= 0 )
   {
      for ( var f = 0; f < wins.length; ++f )
         if ( f != result[4] )
         {
            result[3] = f;
            break;
         }
   }

   // For a Standard-only group of three windows, the remaining image is Integration.
   if ( result[0] < 0 && ( result[1] >= 0 || result[2] >= 0 ) )
   {
      for ( var g = 0; g < wins.length; ++g )
         if ( g != result[1] && g != result[2] && g != result[4] )
         {
            result[0] = g;
            break;
         }
   }

   console.writeln( "Output-role detection across open windows (0-based): standard=" + result[0] +
                    ", rejection_low=" + result[1] + ", rejection_high=" + result[2] +
                    ", drizzle=" + result[3] + ", weights=" + result[4] );
   return result;
}

function defaultDrizzleWeightsIndex( wins, integrationIndex )
{
   var inferred = inferCombinedIndices( wins );
   if ( inferred[4] >= 0 && inferred[4] != integrationIndex )
      return inferred[4];

   var named = findNamedIndexExcluding( wins,
      [ "drizzle_weights", "drizzleweights", "weightmap", "weights" ], [ integrationIndex ] );
   if ( named >= 0 )
      return named;

   if ( integrationIndex < 0 || integrationIndex >= wins.length )
      integrationIndex = 0;

   var integration = wins[integrationIndex].mainView.image;
   var integrationId = normalizeId( wins[integrationIndex].mainView.id );
   var bestIndex = -1;
   var bestScore = -1e9;
   for ( var i = 0; i < wins.length; ++i )
   {
      if ( i == integrationIndex )
         continue;
      var image = wins[i].mainView.image;
      var id = normalizeId( wins[i].mainView.id );
      var score = 0;
      if ( image.width == integration.width && image.height == integration.height ) score += 100;
      else score -= 100;
      if ( integration.numberOfChannels > 1 && image.numberOfChannels == 1 ) score += 40;
      if ( id == integrationId ) score += 30;
      if ( i == integrationIndex + 1 ) score += 25;
      else if ( i == integrationIndex - 1 ) score += 15;
      score -= Math.abs( i - integrationIndex );
      if ( score > bestScore )
      {
         bestScore = score;
         bestIndex = i;
      }
   }
   return bestIndex >= 0 ? bestIndex : (integrationIndex == 0 && wins.length > 1 ? 1 : 0);
}

function ModeDialog()
{
   this.__base__ = Dialog;
   this.__base__();
   this.windowTitle = "XISF Multi-image Packager";
   var self = this;

   this.infoLabel = new Label( this );
   this.infoLabel.text = "Choose one workflow. Standard ImageIntegration saves its three outputs; Drizzle Integration saves its two outputs. Other open output windows are ignored by automatic matching.";
   this.infoLabel.wordWrapping = true;

   this.modeLabel = new Label( this );
   this.modeLabel.text = "Packaging mode:";
   this.modeCombo = new ComboBox( this );
   this.modeCombo.addItem( "Standard ImageIntegration (3 images)" );
   this.modeCombo.addItem( "Drizzle Integration (2 images)" );
   this.modeCombo.currentItem = 0;

   var modeRow = new HorizontalSizer;
   modeRow.spacing = 8;
   modeRow.add( this.modeLabel );
   modeRow.add( this.modeCombo, 100 );

   this.okButton = new PushButton( this );
   this.okButton.text = "Continue";
   this.okButton.onClick = function() { self.ok(); };
   this.cancelButton = new PushButton( this );
   this.cancelButton.text = "Cancel";
   this.cancelButton.onClick = function() { self.cancel(); };

   var buttons = new HorizontalSizer;
   buttons.spacing = 8;
   buttons.addStretch();
   buttons.add( this.okButton );
   buttons.add( this.cancelButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.infoLabel );
   this.sizer.add( modeRow );
   this.sizer.add( buttons );
   this.adjustToContents();
}
ModeDialog.prototype = new Dialog;

function ImageSelectionDialog( wins, mode )
{
   this.__base__ = Dialog;
   this.__base__();
   this.mode = mode; // 0 = standard, 1 = drizzle
   var self = this;
   this.windowTitle = mode == 0 ? "Select ImageIntegration Outputs" :
                                   "Select Drizzle Integration Outputs";
   this.combos = [];

   this.infoLabel = new Label( this );
   if ( mode == 0 )
      this.infoLabel.text = "Select the Integration, Rejection Low, and Rejection High windows from the same ImageIntegration run.";
   else if ( mode == 1 )
      this.infoLabel.text = "Select the Drizzle Integration image and its drizzle_weights image. The weights window may have a different channel count.";
   this.infoLabel.wordWrapping = true;

   var labels, tokens;
   // Detect the roles across all open windows first. The chosen mode then uses
   // only its own three or two inferred outputs, even if both workflows are open.
   var inferred = inferCombinedIndices( wins );
   if ( mode == 0 )
   {
      labels = [ "Integration:", "Rejection Low:", "Rejection High:" ];
      tokens = [ [ "integration", "masterlight" ],
                 [ "rejection_low", "rejectionlow", "rejectionmaplow", "lowrejection", "lowreject" ],
                 [ "rejection_high", "rejectionhigh", "rejectionmaphigh", "highrejection", "highreject" ] ];
   }
   else
   {
      labels = [ "Drizzle Integration:", "Drizzle Weights:" ];
      tokens = [ [ "drizzle_integration", "drizzleintegration", "drizzle", "masterlight" ],
                 [ "drizzle_weights", "drizzleweights", "weightmap", "weights" ] ];
   }

   var defaults = mode == 0 ? [ inferred[0], inferred[1], inferred[2] ] : [ inferred[3], inferred[4] ];

   // Fallbacks for incomplete sets, or for IDs that don't follow the usual naming.
   for ( var d = 0; d < defaults.length; ++d )
      if ( defaults[d] < 0 || defaults[d] >= wins.length )
      {
         if ( mode == 0 )
         {
            var used0 = [];
            if ( defaults[1] >= 0 ) used0.push( defaults[1] );
            if ( defaults[2] >= 0 ) used0.push( defaults[2] );
            if ( d == 0 )
            {
               // Prefer a non-map, non-weight image that matches rejection maps.
               defaults[d] = inferred[0];
               if ( defaults[d] < 0 )
                  for ( var q = 0; q < wins.length; ++q )
                  {
                     var qid = normalizeId( wins[q].mainView.id );
                     if ( used0.indexOf( q ) < 0 && qid.indexOf( "weight" ) < 0 && qid.indexOf( "reject" ) < 0 )
                     { defaults[d] = q; break; }
                  }
            }
            else defaults[d] = findNamedIndexExcluding( wins, tokens[d], used0 );
         }
         else
         {
            if ( d == 0 ) defaults[d] = defaultIndex( wins, tokens[0] );
            else defaults[d] = defaultDrizzleWeightsIndex( wins, defaults[0] );
         }
      }

   // Avoid assigning the same window to multiple roles when IDs are ambiguous.
   var claimed = [];
   for ( var z = 0; z < defaults.length; ++z )
   {
      if ( claimed.indexOf( defaults[z] ) >= 0 )
      {
         var replacement = -1;
         for ( var ri = 0; ri < wins.length; ++ri )
            if ( claimed.indexOf( ri ) < 0 ) { replacement = ri; break; }
         if ( replacement >= 0 ) defaults[z] = replacement;
      }
      claimed.push( defaults[z] );
   }

   // Duplicate view IDs are visually ambiguous in a ComboBox, so show dimensions/channels
   // and list position only when the same ID occurs more than once.
   var labelsForWindow = [];
   for ( var wi = 0; wi < wins.length; ++wi )
   {
      var countSameId = 0;
      for ( var wj = 0; wj < wins.length; ++wj )
         if ( wins[wi].mainView.id == wins[wj].mainView.id ) ++countSameId;
      var img = wins[wi].mainView.image;
      labelsForWindow[wi] = wins[wi].mainView.id;
      if ( countSameId > 1 )
         labelsForWindow[wi] += " (" + img.width + "x" + img.height + ", " + img.numberOfChannels + " ch; window " + (wi+1) + ")";
   }

   this.rows = [];
   for ( var n = 0; n < labels.length; ++n )
   {
      var label = new Label( this );
      label.text = labels[n];
      var combo = new ComboBox( this );
      for ( var i = 0; i < wins.length; ++i )
         combo.addItem( labelsForWindow[i] );
      combo.currentItem = defaults[n] >= 0 && defaults[n] < wins.length ? defaults[n] : 0;
      this.combos.push( combo );
      var row = new HorizontalSizer;
      row.spacing = 8;
      row.add( label );
      row.add( combo, 100 );
      this.rows.push( row );
   }

   if ( mode == 1 && this.combos.length >= 2 )
      this.combos[0].onItemSelected = function( index )
      {
         self.combos[1].currentItem = defaultDrizzleWeightsIndex( wins, index );
      };

   this.okButton = new PushButton( this );
   this.okButton.text = "Continue";
   this.okButton.onClick = function() { self.ok(); };
   this.cancelButton = new PushButton( this );
   this.cancelButton.text = "Cancel";
   this.cancelButton.onClick = function() { self.cancel(); };

   var buttons = new HorizontalSizer;
   buttons.spacing = 8;
   buttons.addStretch();
   buttons.add( this.okButton );
   buttons.add( this.cancelButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.infoLabel );
   for ( var r = 0; r < this.rows.length; ++r )
      this.sizer.add( this.rows[r] );
   this.sizer.add( buttons );
   this.adjustToContents();
}
ImageSelectionDialog.prototype = new Dialog;

function fail( message )
{
   throw new Error( message );
}

function getOutputPath()
{
   var saveDialog = new SaveFileDialog;
   saveDialog.caption = "Save multi-image XISF file";
   saveDialog.filters = [ [ "XISF files", ".xisf" ] ];
   saveDialog.overwritePrompt = true;
   if ( !saveDialog.execute() )
      return "";

   var outputPath = "";
   try
   {
      var selectedPath = saveDialog.filePath;
      if ( selectedPath !== undefined && selectedPath !== null )
         outputPath = String( selectedPath );
   }
   catch ( pathError ) {}
   if ( outputPath.length == 0 )
   {
      try
      {
         var legacySelectedPath = saveDialog.fileName;
         if ( legacySelectedPath !== undefined && legacySelectedPath !== null )
            outputPath = String( legacySelectedPath );
      }
      catch ( legacyPathError ) {}
   }
   if ( outputPath.length == 0 )
      fail( "Could not retrieve the selected output path from SaveFileDialog." );
   if ( outputPath.toLowerCase().substr( outputPath.length - 5 ) != ".xisf" )
      outputPath += ".xisf";
   return outputPath;
}

function findFormat( path, toRead, toWrite )
{
   var suffix = File.extractSuffix( path );
   var ids = [ suffix, "XISF", "xisf" ];
   for ( var i = 0; i < ids.length; ++i )
   {
      try
      {
         var f = new FileFormat( ids[i], toRead, toWrite );
         if ( !f.isNull && (toRead ? f.canRead : f.canWrite) )
         {
            console.writeln( "Using " + (toRead ? "input" : "output") + " format identifier: " + ids[i] );
            return f;
         }
      }
      catch ( e )
      {
         console.writeln( "Format identifier not available: " + ids[i] + " (" + e + ")" );
      }
   }
   return null;
}

function packImages( selected, outputIds, imageTypes, outputPath, mode )
{
   // Avoid accidentally overwriting one of the open source files.
   for ( var q = 0; q < selected.length; ++q )
      if ( selected[q].filePath && selected[q].filePath.toLowerCase() == outputPath.toLowerCase() )
         fail( "The output path matches a source image path. Choose another filename to avoid overwriting a source file." );

   // For ordinary ImageIntegration outputs, retain the original consistency check.
   // Drizzle integration and its weights image can legitimately differ in channel count.
   if ( mode == 0 )
   {
      var baseImage = selected[0].mainView.image;
      var standardOutputCount = 3;
      for ( var k = 1; k < standardOutputCount; ++k )
      {
         var im = selected[k].mainView.image;
         if ( im.width != baseImage.width || im.height != baseImage.height || im.numberOfChannels != baseImage.numberOfChannels )
            fail( "The selected standard ImageIntegration images do not have matching dimensions/channel counts. Confirm they came from the same run." );
      }
   }

   var format = findFormat( outputPath, false, true );
   if ( format == null )
      fail( "PixInsight could not find a writable XISF format module. Check Format Explorer and ensure XISF is installed/enabled." );
   if ( !format.supportsMultipleImages )
      fail( "The current XISF format module did not report multi-image write support." );

   var writer = new FileFormatInstance( format );
   if ( writer.isNull )
      fail( "Could not create the XISF writer instance." );

   var created = false;
   var writeError = null;
   try
   {
      if ( !writer.create( outputPath, "", selected.length ) )
         fail( "Could not create output file:\n" + outputPath );
      created = true;

      for ( var n = 0; n < selected.length; ++n )
      {
         var image = selected[n].mainView.image;
         var description = new ImageDescription;
         description.bitsPerSample = image.bitsPerSample;
         description.ieeefpSampleFormat = image.isReal;
         if ( imageTypes[n] >= 0 )
            description.imageType = imageTypes[n];

         if ( !writer.setOptions( description ) )
            fail( "Failed to set XISF write options for image: " + outputIds[n] );
         if ( !writer.setImageId( outputIds[n] ) )
            fail( "Failed to set internal XISF image ID: " + outputIds[n] );
         if ( !writer.writeImage( image ) )
            fail( "Failed to write image: " + outputIds[n] );
         console.writeln( "Wrote image: " + outputIds[n] );
      }
      if ( !writer.close() )
         fail( "An error was reported while closing/finalizing the XISF file." );
   }
   catch ( e )
   {
      writeError = e;
   }
   finally
   {
      if ( writer.isOpen )
         writer.close();
   }

   if ( writeError != null )
   {
      if ( created && File.exists( outputPath ) )
         try { File.remove( outputPath ); } catch ( removeError ) {}
      fail( "Writing failed:\n" + writeError + "\n\nTried to remove any incomplete output file; source images were not modified." );
   }

   var readFormat = findFormat( outputPath, true, false );
   if ( readFormat == null )
      fail( "Could not find a readable XISF format module for verification." );
   var reader = new FileFormatInstance( readFormat );
   var descriptions = null;
   try
   {
      descriptions = reader.open( outputPath, "" );
      if ( descriptions == null || descriptions.length != selected.length )
         fail( "Post-write verification did not find the expected " + selected.length + " images." );
      console.writeln( "\nOutput verification passed: " + descriptions.length + " images:" );
      for ( var p = 0; p < descriptions.length; ++p )
         console.writeln( "  " + descriptions[p].id );
   }
   finally
   {
      if ( reader.isOpen )
         reader.close();
   }

   var listText = "";
   for ( var z = 0; z < outputIds.length; ++z )
      listText += "\n" + outputIds[z];
   var message = "Packaging completed!\n\n" + outputPath +
                 "\n\nThe file contains " + outputIds.length + " images:" + listText +
                 "\n\nOriginal image windows were not modified.";
   (new MessageBox( message, "XISF Packager", 2, 0 /* information icon, OK button */ )).execute();
}

function main()
{
   var wins = getImageWindows();
   if ( wins.length < 2 )
      fail( "Keep at least two source image windows open before running this script." );

   var modeDialog = new ModeDialog;
   if ( !modeDialog.execute() )
      return;
   var mode = modeDialog.modeCombo.currentItem;
   var required = mode == 0 ? 3 : 2;
   if ( wins.length < required )
      fail( mode == 0 ? "Standard ImageIntegration packaging needs three open output image windows." :
                       "Drizzle Integration packaging needs two open output image windows." );

   var dlg = new ImageSelectionDialog( wins, mode );
   if ( !dlg.execute() )
      return;

   var selected = [];
   for ( var i = 0; i < dlg.combos.length; ++i )
      selected.push( wins[dlg.combos[i].currentItem] );
   for ( var a = 0; a < selected.length; ++a )
      for ( var b = a + 1; b < selected.length; ++b )
         if ( selected[a] == selected[b] )
            fail( "The same image window was selected more than once. Select a different window for each entry." );

   var outputIds, imageTypes;
   if ( mode == 0 )
   {
      outputIds = [ "integration", "rejection_low", "rejection_high" ];
      // PixInsight ImageType: MasterLight=8, RejectionMapLow=11, RejectionMapHigh=10.
      imageTypes = [ 8, 11, 10 ];
   }
   else if ( mode == 1 )
   {
      outputIds = [ "drizzle_integration", "drizzle_weights" ];
      // The integration is tagged as a master light. Leave weights' image type unspecified.
      imageTypes = [ 8, -1 ];
   }

   var outputPath = getOutputPath();
   if ( outputPath.length == 0 )
      return;
   packImages( selected, outputIds, imageTypes, outputPath, mode );
}

try
{
   main();
}
catch ( e )
{
   console.criticalln( "XISF Multi-image Packager: " + e );
   (new MessageBox( "Packaging failed:\n\n" + e, "XISF Packager", 4, 0 /* error icon, OK button */ )).execute();
}
