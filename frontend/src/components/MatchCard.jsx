import React from "react";
import PropTypes from "prop-types";
import { Card } from "./ui/card";
import { CardContent } from "./ui/card";
import { Button } from "./ui/button";

export function MatchCard({ match, onToggleJoin }) {
  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-foreground capitalize">{match.sport}</h3>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {match.location}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {match.currentParticipants}/{match.capacity}
            </div>
            <div className="text-xs text-muted-foreground">players</div>
          </div>
        </div>

        {match.datetime && (
          <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(match.datetime).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        <Button
          onClick={() => onToggleJoin(match.id)}
          className={`w-full mt-4 ${
            match.isJoined
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }`}
        >
          {match.isJoined ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Leave Match
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Join Match
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

MatchCard.propTypes = {
  match: PropTypes.shape({
    id: PropTypes.string.isRequired,
    sport: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    currentParticipants: PropTypes.number.isRequired,
    capacity: PropTypes.number.isRequired,
    isJoined: PropTypes.bool.isRequired,
  }).isRequired,
  onToggleJoin: PropTypes.func.isRequired,
};