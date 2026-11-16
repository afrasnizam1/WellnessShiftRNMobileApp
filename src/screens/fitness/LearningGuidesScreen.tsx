import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Typography, Spacing, Radius, tabBarScrollPadding } from '../../theme';
import { ScreenHeader } from '../../components/ui';
import AppScreen from '../../components/common/AppScreen';
import FeaturedGuideCard from '../../components/fitness/FeaturedGuideCard';
import { LEARNING_GUIDES, filterLearningGuides, type LearningGuide } from '../../data/learningGuides';
import { Screen } from '../../navigation/screenNames';

const LEARNING_ROUTES: Record<string, string> = {
  vitamins: Screen.vitaminsLearning,
  'nutrition-basics': Screen.nutritionBasics,
  'lung-health': Screen.lungHealth,
  'targeted-treatment': Screen.targetedTreatment,
  'multiple-myeloma': Screen.multipleMyeloma,
};

function learningRoute(guideId: string): { screen: string; params?: object } {
  const dedicated = LEARNING_ROUTES[guideId];
  if (dedicated) return { screen: dedicated };
  return { screen: Screen.learningGuide, params: { topicId: guideId } };
}

const H_PAD = Spacing.lg;
const GAP = Spacing.md;

export default function LearningGuidesScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const cardWidth = useMemo(
    () => (width - H_PAD * 2 - GAP) / 2,
    [width],
  );
  const guides = useMemo(() => filterLearningGuides(searchQuery), [searchQuery]);

  const openGuide = useCallback(
    (guideId: string) => {
      const route = learningRoute(guideId);
      navigation.navigate(route.screen, route.params);
    },
    [navigation],
  );

  const renderItem: ListRenderItem<LearningGuide> = useCallback(
    ({ item }) => (
      <FeaturedGuideCard
        guide={item}
        onPress={() => openGuide(item.id)}
        style={[styles.gridCard, { width: cardWidth }]}
      />
    ),
    [cardWidth, openGuide],
  );

  return (
    <AppScreen style={styles.safe}>
      <ScreenHeader
        title="Learning"
        subtitle={`${guides.length} of ${LEARNING_GUIDES.length} guides`}
        onBack={() => navigation.goBack()}
      />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search learning..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={guides}
        keyExtractor={(g) => g.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperStyle={guides.length > 0 ? styles.row : undefined}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          searchQuery.trim() ? null : (
            <Text style={styles.intro}>
              Browse all learning modules — nutrition, recovery, habits, and more.
            </Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No guides found</Text>
            <Text style={styles.emptyText}>Try a different search term</Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: Spacing.sm,
    marginHorizontal: H_PAD,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: Typography.size.base, color: Colors.text, padding: 0 },
  list: {
    paddingHorizontal: H_PAD,
    paddingBottom: tabBarScrollPadding,
  },
  intro: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: GAP,
  },
  gridCard: {
    marginRight: 0,
    height: 148,
  },
  empty: {
    paddingTop: Spacing['2xl'],
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: { fontSize: Typography.size.lg, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: Typography.size.sm, color: Colors.textSecondary },
});
